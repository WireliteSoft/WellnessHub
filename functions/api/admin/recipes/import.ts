// functions/api/admin/recipes/import.ts
import { requireUser, requireAdmin } from "../../../_utils/auth";

// ---- Types from TheMealDB ----
type MealDBMeal = {
  idMeal: string;
  strMeal: string;
  strCategory?: string;
  strInstructions?: string;
  strMealThumb?: string;
  [k: string]: any; // strIngredient1..20, strMeasure1..20, etc.
};

export const onRequestPost: PagesFunction = async ({ env, request }) => {
  try {
    // Auth (same pattern as your other admin APIs)
    const user = await requireUser(env as any, request);
    requireAdmin(user);

    let body: any = null;
    try { body = await request.json(); } catch {}

    // Accept: {url}, {urls: []}, or {id}
    const inputs: string[] = Array.isArray(body?.urls)
      ? body.urls
      : body?.url
      ? [body.url]
      : body?.id
      ? [String(body.id)]
      : [];

    if (inputs.length === 0) {
      return json({ ok: false, error: "Provide 'url', 'urls', or 'id'." }, 400);
    }

    const limit = toInt(body?.limit, 25); // cap search/filter expansion
    const overrideCategory = asCategory(body?.category);

    const results: { input: string; ok: boolean; inserted?: number; updated?: number; errors?: string[] }[] = [];

    for (const raw of inputs) {
      try {
        const { inserted, updated } = await importFromInput(env, raw, user.id, overrideCategory, limit);
        results.push({ input: raw, ok: true, inserted, updated });
      } catch (e: any) {
        results.push({ input: raw, ok: false, errors: [e?.message || "Import failed"] });
      }
    }

    const summary = results.reduce(
      (a, r) => {
        if (r.ok) {
          a.succeeded += 1;
          a.inserted += r.inserted || 0;
          a.updated += r.updated || 0;
        } else {
          a.failed += 1;
        }
        return a;
      },
      { succeeded: 0, failed: 0, inserted: 0, updated: 0 }
    );

    return json({ ok: true, ...summary, results });
  } catch (e: any) {
    // Convert worker crashes into JSON so your UI never gets HTML error pages
    return json({ ok: false, error: e?.message || "Server error" }, 500);
  }
};

// ---------- helpers ----------

function json(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function toInt(v: any, d: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : d;
}

function asCategory(v: any): ("breakfast" | "lunch" | "dinner" | "snack" | "other") | undefined {
  if (!v) return undefined;
  const s = String(v).toLowerCase();
  if (["breakfast", "lunch", "dinner", "snack", "other"].includes(s)) return s as any;
  return undefined;
}

function mapCategory(mealcat?: string): "breakfast" | "lunch" | "dinner" | "snack" | "other" {
  const c = (mealcat || "").toLowerCase();
  if (c.includes("breakfast")) return "breakfast";
  if (["starter", "side", "dessert", "snack"].some(k => c.includes(k))) return "snack";
  if (["beef", "chicken", "lamb", "pork", "seafood", "pasta", "miscellaneous", "goat", "vegetarian", "vegan"].some(k => c.includes(k))) {
    return "dinner";
  }
  return "other";
}

async function importFromInput(
  env: any,
  input: string,
  createdBy: string,
  overrideCategory: ("breakfast" | "lunch" | "dinner" | "snack" | "other") | undefined,
  limit: number
): Promise<{ inserted: number; updated: number }> {
  const base = "https://www.themealdb.com/api/json/v1/1";

  // raw numeric id → lookup
  if (/^\d+$/.test(input.trim())) {
    const m = await fetchMealById(base, input.trim());
    return upsertMeals(env, [m], createdBy, overrideCategory);
  }

  // URL cases
  let u: URL | null = null;
  try { u = new URL(input); } catch { /* not a URL */ }
  if (!u) throw new Error("Not a valid URL or MealDB id.");

  if (!/themealdb\.com$/i.test(u.hostname) && !/\.themealdb\.com$/i.test(u.hostname)) {
    throw new Error("Unsupported source (only TheMealDB URLs are supported).");
  }

  // lookup.php?i=ID
  if (u.pathname.endsWith("/lookup.php")) {
    const id = u.searchParams.get("i");
    if (!id) throw new Error("lookup.php requires ?i=<idMeal>");
    const m = await fetchMealById(base, id);
    return upsertMeals(env, [m], createdBy, overrideCategory);
  }

  // search.php?s=term
  if (u.pathname.endsWith("/search.php")) {
    const term = u.searchParams.get("s") ?? "";
    const data = await safeJsonFetch(`${base}/search.php?s=${encodeURIComponent(term)}`);
    const meals: MealDBMeal[] = Array.isArray(data?.meals) ? data.meals.slice(0, limit) : [];
    if (!meals.length) return { inserted: 0, updated: 0 };
    return upsertMeals(env, meals, createdBy, overrideCategory);
  }

  // filter.php?c= / ?a= / ?i=
  if (u.pathname.endsWith("/filter.php")) {
    if (![...u.searchParams.keys()].some(k => ["c", "a", "i"].includes(k))) {
      throw new Error("filter.php requires ?c=, ?a=, or ?i= parameter.");
    }
    const listData = await safeJsonFetch(u.toString());
    const ids: string[] = (Array.isArray(listData?.meals) ? listData.meals : [])
      .map((x: any) => x?.idMeal)
      .filter(Boolean)
      .slice(0, limit);

    const meals: MealDBMeal[] = [];
    for (const id of ids) {
      try { meals.push(await fetchMealById(base, id)); } catch { /* skip */ }
    }
    if (!meals.length) return { inserted: 0, updated: 0 };
    return upsertMeals(env, meals, createdBy, overrideCategory);
  }

  throw new Error("Unsupported MealDB path. Use lookup.php, search.php, filter.php, or a numeric id.");
}

async function safeJsonFetch(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
  const ct = res.headers.get("content-type") || "";
  if (!/application\/json/i.test(ct)) {
    const txt = await res.text();
    throw new Error(`Non-JSON response from source (content-type: ${ct || "unknown"}). First 120 bytes: ${txt.slice(0, 120)}`);
  }
  return await res.json();
}

async function fetchMealById(base: string, id: string): Promise<MealDBMeal> {
  const data = await safeJsonFetch(`${base}/lookup.php?i=${encodeURIComponent(id)}`);
  const m: MealDBMeal | undefined = Array.isArray(data?.meals) ? data.meals[0] : undefined;
  if (!m) throw new Error(`Meal ${id} not found`);
  return m;
}

function extractIngredients(m: MealDBMeal) {
  const out: { name: string; quantity?: string; position: number }[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = (m[`strIngredient${i}`] || "").toString().trim();
    const qty  = (m[`strMeasure${i}`]    || "").toString().trim();
    if (name) out.push({ name, quantity: qty || undefined, position: out.length + 1 });
  }
  return out;
}

function extractSteps(m: MealDBMeal) {
  const raw = (m.strInstructions || "").toString();
  const lines = raw.split(/\r?\n+/).map(s => s.trim()).filter(Boolean);
  return lines.map((text, idx) => ({ step_no: idx + 1, text }));
}

async function upsertMeals(
  env: any,
  meals: MealDBMeal[],
  createdBy: string,
  overrideCategory?: "breakfast" | "lunch" | "dinner" | "snack" | "other"
): Promise<{ inserted: number; updated: number }> {
  let inserted = 0, updated = 0;
  const NOW = "datetime('now')";
  const extSource = "mealdb";

  for (const m of meals) {
    const extId = m.idMeal;
    // Does it exist?
    const found = await env.DB
      .prepare("SELECT id FROM recipes WHERE external_source=? AND external_id=? LIMIT 1")
      .bind(extSource, extId)
      .all();
    const existingId = found?.results?.[0]?.id as string | undefined;
    const rid = existingId ?? crypto.randomUUID();

    const title = m.strMeal?.toString().trim() || "Untitled";
    const category = overrideCategory ?? mapCategory(m.strCategory);
    const description = ""; // MealDB doesn't have a separate description
    const image = m.strMealThumb || null;

    // Build statements
    const stmts: D1PreparedStatement[] = [];

    if (!existingId) {
      stmts.push(
        env.DB.prepare(
          "INSERT INTO recipes (id,title,category,description,image_url,created_by,is_public,published,external_source,external_id,created_at,updated_at) VALUES (?,?,?,?,?,?,1,1,?,?,"
          + NOW + "," + NOW + ")"
        ).bind(rid, title, category, description, image, createdBy, extSource, extId)
      );
      inserted++;
    } else {
      stmts.push(
        env.DB.prepare(
          "UPDATE recipes SET title=?, category=?, description=?, image_url=?, updated_at=" + NOW + " WHERE id=?"
        ).bind(title, category, description, image, rid)
      );
      updated++;
    }

    // Replace children
    stmts.push(env.DB.prepare("DELETE FROM recipe_ingredients WHERE recipe_id=?").bind(rid));
    stmts.push(env.DB.prepare("DELETE FROM recipe_steps WHERE recipe_id=?").bind(rid));
    stmts.push(
      env.DB.prepare(
        "INSERT OR REPLACE INTO recipe_nutrition (recipe_id, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg) VALUES (?,?,?,?,?,?,?,?)"
      ).bind(rid, 0, 0, 0, 0, 0, 0, 0)
    );

    const ings = extractIngredients(m);
    for (let i = 0; i < ings.length; i++) {
      const ing = ings[i];
      stmts.push(
        env.DB.prepare("INSERT INTO recipe_ingredients (id,recipe_id,name,quantity,position) VALUES (?,?,?,?,?)")
          .bind(crypto.randomUUID(), rid, ing.name, ing.quantity ?? null, ing.position || i + 1)
      );
    }

    const steps = extractSteps(m);
    for (const s of steps) {
      stmts.push(
        env.DB.prepare("INSERT INTO recipe_steps (id,recipe_id,step_no,text) VALUES (?,?,?,?)")
          .bind(crypto.randomUUID(), rid, s.step_no, s.text)
      );
    }

    // Run in safe chunks to avoid D1 batch limits
    await runBatchInChunks(env.DB, stmts, 20);
  }

  return { inserted, updated };
}

async function runBatchInChunks(db: D1Database, statements: D1PreparedStatement[], chunkSize: number) {
  for (let i = 0; i < statements.length; i += chunkSize) {
    const slice = statements.slice(i, i + chunkSize);
    await db.batch(slice);
  }
}
