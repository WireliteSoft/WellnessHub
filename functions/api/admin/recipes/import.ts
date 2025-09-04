// functions/api/admin/recipes/import.ts
import { requireUser, requireAdmin } from "../../../_utils/auth";

type NormalizedRecipe = {
  external_source: string;
  external_id: string;
  title: string;
  category: "breakfast" | "lunch" | "dinner" | "snack" | "other";
  description?: string;
  image?: string | null;
  ingredients: { name: string; quantity?: string | null }[];
  steps: string[];
};

export const onRequestPost: PagesFunction = async (ctx) => {
  try {
    const { env, request } = ctx;
    const me = await requireUser(env as any, request);
    requireAdmin(me);

    const body = await request.json<{
      source?: "mealdb";
      // MealDB
      url?: string;
      id?: string | number;
      // options
      public?: boolean;
      publish?: boolean;
      category?: NormalizedRecipe["category"];
    }>();

    const source = (body.source || "mealdb").toLowerCase();
    if (source !== "mealdb") {
      return json({ error: "Only 'mealdb' is implemented in this endpoint." }, 400);
    }

    // ---- Fetch & normalize from TheMealDB ----
    const meal = await fetchMealDb(body);
    if (!meal) return json({ error: "No meal found" }, 404);

    const normalized: NormalizedRecipe = {
      external_source: "mealdb",
      external_id: String(meal.idMeal),
      title: meal.strMeal || "Untitled",
      category: body.category || mapMealDbCategory(meal.strCategory),
      description: meal.strArea ? `Origin: ${meal.strArea}` : undefined,
      image: meal.strMealThumb || null,
      ingredients: extractMealDbIngredients(meal),
      steps: splitMealDbInstructions(meal.strInstructions),
    };

    // ---- Upsert into D1 ----
    const rid = await upsertRecipe(env.DB, me.id, normalized, {
      is_public: body.public ?? true,
      published: body.publish ?? true,
    });

    return json({ ok: true, id: rid, imported: normalized });
  } catch (err: any) {
    console.error("POST /api/admin/recipes/import failed:", err);
    return json({ error: err?.message || "Server error", stack: err?.stack }, 500);
  }
};

/* ---------------- helpers ---------------- */

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function fetchMealDb(body: any) {
  const base = "https://www.themealdb.com/api/json/v1/1";
  // prefer id
  if (body.id) {
    const r = await fetch(`${base}/lookup.php?i=${encodeURIComponent(body.id)}`);
    if (!r.ok) throw new Error(`MealDB (lookup) ${r.status}`);
    const j = await r.json();
    return j.meals?.[0] || null;
  }
  // else url
  if (body.url) {
    const u = new URL(body.url);
    const id =
      u.searchParams.get("i") ||
      u.searchParams.get("mealId") ||
      u.pathname.split("/").pop();
    if (!id) throw new Error("Could not parse MealDB id from url");
    const r = await fetch(`${base}/lookup.php?i=${encodeURIComponent(id)}`);
    if (!r.ok) throw new Error(`MealDB (lookup) ${r.status}`);
    const j = await r.json();
    return j.meals?.[0] || null;
  }
  throw new Error("Provide 'id' or 'url'");
}

function extractMealDbIngredients(meal: any) {
  const out: { name: string; quantity?: string | null }[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = (meal[`strIngredient${i}`] || "").trim();
    const qty = (meal[`strMeasure${i}`] || "").trim();
    if (!name) continue;
    out.push({ name, quantity: qty || null });
  }
  return out;
}

function splitMealDbInstructions(txt?: string | null) {
  if (!txt) return [];
  return String(txt)
    .split(/\r?\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function mapMealDbCategory(c?: string | null) {
  const v = (c || "").toLowerCase();
  if (["breakfast"].includes(v)) return "breakfast";
  if (["lunch"].includes(v)) return "lunch";
  if (["beef", "chicken", "pork", "seafood", "vegan", "vegetarian", "miscellaneous", "side", "pasta", "goat", "lamb", "dessert", "starter"].includes(v))
    return "dinner";
  return "other";
}

async function upsertRecipe(
  DB: D1Database,
  userId: string,
  r: NormalizedRecipe,
  opts: { is_public: boolean; published: boolean }
) {
  // find existing by external key
  const find = await DB.prepare(
    "SELECT id FROM recipes WHERE external_source = ? AND external_id = ? LIMIT 1"
  ).bind(r.external_source, r.external_id).all();

  const now = new Date().toISOString();
  let rid = (find.results?.[0] as any)?.id as string | undefined;

  if (!rid) {
    rid = crypto.randomUUID();
    await DB.prepare(
      `INSERT INTO recipes
       (id, title, category, description, image_url, created_by, is_public, published, external_source, external_id, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      rid,
      r.title,
      r.category,
      r.description ?? null,
      r.image ?? null,
      userId,
      opts.is_public ? 1 : 0,
      opts.published ? 1 : 0,
      r.external_source,
      r.external_id,
      now,
      now
    ).run();
  } else {
    await DB.prepare(
      `UPDATE recipes
       SET title=?, category=?, description=?, image_url=?, is_public=?, published=?, updated_at=?
       WHERE id=?`
    ).bind(
      r.title,
      r.category,
      r.description ?? null,
      r.image ?? null,
      opts.is_public ? 1 : 0,
      opts.published ? 1 : 0,
      now,
      rid
    ).run();
  }

  // wipe & reinsert ingredients/steps (idempotent)
  await DB.batch([
    DB.prepare("DELETE FROM recipe_ingredients WHERE recipe_id=?").bind(rid),
    DB.prepare("DELETE FROM recipe_steps WHERE recipe_id=?").bind(rid),
  ]);

  for (let i = 0; i < r.ingredients.length; i++) {
    const ing = r.ingredients[i];
    await DB.prepare(
      "INSERT INTO recipe_ingredients (id, recipe_id, name, quantity, position) VALUES (?,?,?,?,?)"
    ).bind(crypto.randomUUID(), rid, ing.name, ing.quantity ?? null, i + 1).run();
  }

  if (r.steps.length) {
    for (let i = 0; i < r.steps.length; i++) {
      await DB.prepare(
        "INSERT INTO recipe_steps (id, recipe_id, step_no, text) VALUES (?,?,?,?)"
      ).bind(crypto.randomUUID(), rid, i + 1, r.steps[i]).run();
    }
  }

  // ensure a nutrition row exists (zeros)
  await DB.prepare(
    `INSERT OR IGNORE INTO recipe_nutrition
     (recipe_id, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg)
     VALUES (?,0,0,0,0,0,0,0)`
  ).bind(rid).run();

  return rid;
}
