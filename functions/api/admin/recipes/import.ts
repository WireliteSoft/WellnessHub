// functions/api/admin/recipes/import.ts
import { requireUser, requireAdmin } from "../../../_utils/auth";

type MealDBMeal = {
  idMeal: string;
  strMeal: string;
  strCategory?: string;
  strInstructions?: string;
  strMealThumb?: string;
  [k: string]: any; // strIngredient1..20, strMeasure1..20 etc
};

export const onRequestPost: PagesFunction = async ({ env, request }) => {
  // auth (use same pattern as your other admin APIs)
  const user = await requireUser(env as any, request);
  requireAdmin(user);

  let body: any = null;
  try { body = await request.json(); } catch {}
  // front-end can send: { url?: string, urls?: string[], id?: string|number, category?: 'breakfast'|'lunch'|'dinner'|'snack'|'other' }
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

  const results: { input: string; ok: boolean; inserted?: number; updated?: number; errors?: string[] }[] = [];
  for (const raw of inputs) {
    try {
      const r = await importFromInput(env, raw, user.id, body?.category);
      results.push({ input: raw, ok: true, inserted: r.inserted, updated: r.updated });
    } catch (e: any) {
      results.push({ input: raw, ok: false, errors: [e?.message || "Import failed"] });
    }
  }

  const summary = results.reduce(
    (acc, r) => {
      if (r.ok) { acc.succeeded += 1; acc.inserted += r.inserted || 0; acc.updated += r.updated || 0; }
      else acc.failed += 1;
      return acc;
    },
    { succeeded: 0, failed: 0, inserted: 0, updated: 0 }
  );

  return json({ ok: true, ...summary, results });
};

// ---- helpers ----

function json(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function importFromInput(
  env: any,
  input: string,
  createdBy: string,
  overrideCategory?: "breakfast" | "lunch" | "dinner" | "snack" | "other"
): Promise<{ inserted: number; updated: number }> {
  const base = "https://www.themealdb.com/api/json/v1/1";

  // raw numeric/id → lookup single
  if (/^\d+$/.test(input.trim())) {
    const m = await fetchMealById(base, input.trim());
    return upsertMeals(env, [m], createdBy, overrideCategory);
  }

  // try as URL
  let u: URL | null = null;
  try { u = new URL(input); } catch { /* not a URL */ }
  if (!u) throw new Error("Not a valid URL or MealDB id.");

  if (!/themealdb\.com/i.test(u.hostname)) {
    throw new Error("Unsupported source (only TheMealDB URLs are supported).");
  }

  // Handle lookup.php?i=ID (single)
  if (u.pathname.endsWith("/lookup.php")) {
    const id = u.searchParams.get("i");
    if (!id) throw new Error("lookup.php must include ?i=<idMeal>");
    const m = await fetchMealById(base, id);
    return upsertMeals(env, [m], createdBy, overrideCategory);
  }

  // Handle search.php?s=term (many)
  if (u.pathname.endsWith("/search.php")) {
    const term = u.searchParams.get("s") ?? "";
    const res = await fetch(`${base}/search.php?s=${encodeURIComponent(term)}`);
    if (!res.ok) throw new Error(`MealDB search failed (${res.status})`);
    const data = await res.json();
    const meals: MealDBMeal[] = Array.isArray(data?.meals) ? data.meals : [];
    if (meals.length === 0) return { inserted: 0, updated: 0 };
    // (search already returns full meals)
    return upsertMeals(env, meals, createdBy, overrideCategory);
  }

  // Handle filter.php?c=Category / ?a=Area / ?i=Ingredient (ids only → follow-up lookups)
  if (u.pathname.endsWith("/filter.php")) {
    if (![...u.searchParams.keys()].some(k => ["c","a","i"].includes(k))) {
      throw new Error("filter.php requires ?c=, ?a= or ?i= parameter.");
    }
    const res = await fetch(input);
    if (!res.ok) throw new Error(`MealDB filter failed (${res.status})`);
    const data = await res.json();
    const list: { idMeal: string }[] = Array.isArray(data?.meals) ? data.meals : [];
    if (list.length === 0) return { inserted: 0, updated: 0 };

    // fetch details for each id (limit to a reasonable batch)
    const ids = list.map(x => x.idMeal).filter(Boolean).slice(0, 50);
    const meals: MealDBMeal[] = [];
    for (const id of ids) {
      try { meals.push(await fetchMealById(base, id)); } catch { /* skip broken */ }
    }
    return upsertMeals(env, meals, createdBy, overrideCategory);
  }

  throw new Error("Unsupported MealDB path. Use lookup.php, search.php, filter.php, or a numeric id.");
}

async function fetchMealById(base: string, id: string): Promise<MealDBMeal> {
  const res = await fetch(`${base}/lookup.php?i=${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`MealDB lookup failed (${res.status})`);
  const data = await res.json();
  const m: MealDBMeal | undefined = Array.isArray(data?.meals) ? data.meals[0] : undefined;
  if (!m) throw new Error(`Meal ${id} not found`);
  return m;
}

function mapCategory(mealcat?: string): "breakfast" | "lunch" | "dinner" | "snack" | "other" {
  const c = (mealcat || "").toLowerCase();
  if (c.includes("breakfast")) return "breakfast";
  if (["starter","side","dessert","snack"].some(k => c.includes(k))) return "snack";
  if (["beef","chicken","lamb","pork","seafood","pasta","miscellaneous","goat","vegetarian","vegan"].some(k => c.includes(k))) {
    return "dinner";
  }
  return "other";
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
  // split on blank lines or newlines; trim empties
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

  for (const m of meals) {
    const extSource = "mealdb";
    const extId = m.idMeal;

    // does it already exist?
    const found = await env.DB
      .prepare("SELECT id FROM recipes WHERE external_source=? AND external_id=? LIMIT 1")
      .bind(extSource, extId)
      .all();
    const existingId = found?.results?.[0]?.id as string | undefined;
    const rid = existingId ?? crypto.randomUUID();

    const title = m.strMeal?.toString().trim() || "Untitled";
    const category = overrideCategory ?? mapCategory(m.strCategory);
    const description = ""; // MealDB doesn’t have a true description field; we’ll keep empty
    const image = m.strMealThumb || null;

    const nowSql = "datetime('now')";
    const statements: D1PreparedStatement[] = [];

    if (!existingId) {
      statements.push(
        env.DB.prepare(
          "INSERT INTO recipes (id,title,category,description,image_url,created_by,is_public,published,external_source,external_id,created_at,updated_at) VALUES (?,?,?,?,?,?,1,1,?,?,"
          + nowSql + "," + nowSql + ")"
        ).bind(rid, title, category, description, image, createdBy, extSource, extId)
      );
      inserted++;
    } else {
      statements.push(
        env.DB.prepare(
          "UPDATE recipes SET title=?, category=?, description=?, image_url=?, updated_at=" + nowSql + " WHERE id=?"
        ).bind(title, category, description, image, rid)
      );
      updated++;
    }

    // wipe + reinsert children
    statements.push(env.DB.prepare("DELETE FROM recipe_ingredients WHERE recipe_id=?").bind(rid));
    statements.push(env.DB.prepare("DELETE FROM recipe_steps WHERE recipe_id=?").bind(rid));
    statements.push(env.DB.prepare("INSERT OR REPLACE INTO recipe_nutrition (recipe_id, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg) VALUES (?,?,?,?,?,?,?,?)")
      .bind(rid, 0, 0, 0, 0, 0, 0, 0));

    const ings = extractIngredients(m);
    ings.forEach((ing, i) => {
      statements.push(
        env.DB
          .prepare("INSERT INTO recipe_ingredients (id, recipe_id, name, quantity, position) VALUES (?,?,?,?,?)")
          .bind(crypto.randomUUID(), rid, ing.name, ing.quantity ?? null, ing.position || i + 1)
      );
    });

    const steps = extractSteps(m);
    steps.forEach((s) => {
      statements.push(
        env.DB
          .prepare("INSERT INTO recipe_steps (id, recipe_id, step_no, text) VALUES (?,?,?,?)")
          .bind(crypto.randomUUID(), rid, s.step_no, s.text)
      );
    });

    await env.DB.batch(statements);
  }

  return { inserted, updated };
}
