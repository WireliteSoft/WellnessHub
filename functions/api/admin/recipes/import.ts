// functions/api/admin/recipes/import.ts
// POST /api/admin/recipes/import
// Body shapes supported:
// 1) { url: "https://www.themealdb.com/meal/52874", publish?: boolean, public?: boolean, category?: "breakfast"|"lunch"|"dinner"|"snack"|"other" }
// 2) { source: "mealdb", id: "52874", publish?: boolean, public?: boolean, category?: ... }
//
// Requires: tables recipes, recipe_ingredients, recipe_steps, recipe_nutrition (optional), and columns
// recipes.external_source, recipes.external_id + unique index uq_recipes_external(external_source, external_id)

import { requireUser, requireAdmin } from "../../../_utils/auth";

type MealCategory = "breakfast" | "lunch" | "dinner" | "snack" | "other";

type NormalizedRecipe = {
  external_source: string;       // e.g. 'themealdb'
  external_id: string;           // e.g. '52874'
  title: string;
  category: MealCategory;
  description?: string;
  image?: string | null;
  ingredients: { name: string; quantity?: string | null }[];
  steps: string[];
};

const MEALDB_LOOKUP = "https://www.themealdb.com/api/json/v1/1/lookup.php?i=";

function mapCategoryGuess(input?: string): MealCategory {
  if (!input) return "other";
  const s = input.toLowerCase();
  if (s.includes("breakfast")) return "breakfast";
  if (s.includes("lunch")) return "lunch";
  if (s.includes("dinner") || s.includes("main")) return "dinner";
  if (s.includes("snack")) return "snack";
  return "other";
}

function extractMealDbIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("themealdb.com")) return null;
    // patterns that may appear:
    // /meal/<id> OR /api/json/v1/1/lookup.php?i=<id>
    const m = u.pathname.match(/\/meal\/(\d+)/);
    if (m?.[1]) return m[1];
    const id = u.searchParams.get("i");
    if (id) return id;
    return null;
  } catch {
    return null;
  }
}

async function fetchMealDbById(id: string): Promise<NormalizedRecipe | null> {
  const r = await fetch(MEALDB_LOOKUP + encodeURIComponent(id));
  if (!r.ok) throw new Error(`MealDB lookup failed: ${r.status}`);
  const json = await r.json() as any;
  const meal = json?.meals?.[0];
  if (!meal) return null;

  // Collect up to 20 ingredient+measure pairs
  const ingredients: { name: string; quantity?: string | null }[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = (meal[`strIngredient${i}`] || "").trim();
    const qty = (meal[`strMeasure${i}`] || "").trim();
    if (!name) continue;
    ingredients.push({ name, quantity: qty || null });
  }

  // Split instructions by line breaks / numbered lines
  let steps: string[] = [];
  const instr: string = meal.strInstructions || "";
  if (instr) {
    steps = instr
      .split(/\r?\n+/)
      .map(s => s.replace(/^\d+[\).\s-]+/, "").trim())
      .filter(Boolean);
  }

  return {
    external_source: "themealdb",
    external_id: String(meal.idMeal),
    title: meal.strMeal || "Untitled",
    category: mapCategoryGuess(meal.strCategory || meal.strArea || ""),
    description: meal.strArea ? `${meal.strArea} cuisine` : undefined,
    image: meal.strMealThumb || null,
    ingredients,
    steps
  };
}

export const onRequestPost: PagesFunction = async ({ env, request }) => {
  // --- Auth guard (must be admin) ---
  const user = await requireUser(env as any, request);
  requireAdmin(user);

  // --- Parse input ---
  type In =
    | { url: string; publish?: boolean; public?: boolean; category?: MealCategory }
    | { source: "mealdb"; id: string; publish?: boolean; public?: boolean; category?: MealCategory };

  let body: In | null = null;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // --- Normalize from supported sources ---
  let normalized: NormalizedRecipe | null = null;

  // A) MealDB via explicit source/id
  if (body && "source" in body && body.source === "mealdb" && body.id) {
    normalized = await fetchMealDbById(body.id);
    if (!normalized) return new Response("Not found on TheMealDB", { status: 404 });
  }

  // B) URL form; try to recognize TheMealDB
  if (!normalized && body && "url" in body && body.url) {
    const id = extractMealDbIdFromUrl(body.url);
    if (id) {
      normalized = await fetchMealDbById(id);
      if (!normalized) return new Response("Not found on TheMealDB", { status: 404 });
    } else {
      // Future: add scrapers for other sources here (AllRecipes, BBC GoodFood, etc.)
      // For now, bail out with a helpful message.
      return new Response("Only TheMealDB URLs are supported right now.", { status: 400 });
    }
  }

  if (!normalized) {
    return new Response("Missing url or (source,id).", { status: 400 });
  }

  // Allow caller to override category/publication flags
  const is_public = "public" in (body as any) ? ((body as any).public ? 1 : 0) : 1;
  const published = "publish" in (body as any) ? ((body as any).publish ? 1 : 0) : 1;
  const finalCategory = ("category" in (body as any) && (body as any).category)
    ? (body as any).category as MealCategory
    : normalized.category;

  // --- Upsert logic based on external_source/external_id ---
  // 1) Look up existing by external keys
  const sel = await env.DB
    .prepare(
      "SELECT id FROM recipes WHERE external_source=? AND external_id=? LIMIT 1"
    )
    .bind(normalized.external_source, normalized.external_id)
    .first<{ id: string }>();

  // We'll perform a small transaction so ingredients/steps stay in sync
  const statements: D1PreparedStatement[] = [];
  const now = new Date().toISOString();

  let recipeId = sel?.id ?? crypto.randomUUID();

  if (sel?.id) {
    // Update existing core fields
    statements.push(
      env.DB.prepare(
        `UPDATE recipes
           SET title=?, category=?, description=?, image_url=?, is_public=?, published=?, updated_at=?
         WHERE id=?`
      ).bind(
        normalized.title,
        finalCategory,
        normalized.description ?? null,
        normalized.image ?? null,
        is_public,
        published,
        now,
        recipeId
      )
    );
    // Clear and replace ingredients + steps
    statements.push(
      env.DB.prepare("DELETE FROM recipe_ingredients WHERE recipe_id=?").bind(recipeId),
      env.DB.prepare("DELETE FROM recipe_steps       WHERE recipe_id=?").bind(recipeId)
    );
  } else {
    // Fresh insert
    statements.push(
      env.DB.prepare(
        `INSERT INTO recipes
           (id, title, category, description, image_url, created_by,
            is_public, published, external_source, external_id, created_at, updated_at)
         VALUES (?,?,?,?,?,?, ?,?,?,?, datetime('now'), datetime('now'))`
      ).bind(
        recipeId,
        normalized.title,
        finalCategory,
        normalized.description ?? null,
        normalized.image ?? null,
        user.id,
        is_public,
        published,
        normalized.external_source,
        normalized.external_id
      )
    );
  }

  // Ingredients
  normalized.ingredients.forEach((ing, i) => {
    if (!ing.name?.trim()) return;
    statements.push(
      env.DB
        .prepare(
          "INSERT INTO recipe_ingredients (id, recipe_id, name, quantity, position) VALUES (?,?,?,?,?)"
        )
        .bind(crypto.randomUUID(), recipeId, ing.name.trim(), ing.quantity ?? null, i + 1)
    );
  });

  // Steps
  normalized.steps.forEach((txt, i) => {
    const t = txt.trim();
    if (!t) return;
    statements.push(
      env.DB
        .prepare("INSERT INTO recipe_steps (id, recipe_id, step_no, text) VALUES (?,?,?,?)")
        .bind(crypto.randomUUID(), recipeId, i + 1, t)
    );
  });

  // (Optional) ensure a nutrition row exists with zeros (your list query COALESCEs, so this is optional)
  statements.push(
    env.DB
      .prepare(
        `INSERT OR IGNORE INTO recipe_nutrition
           (recipe_id, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg)
         VALUES (?,0,0,0,0,0,0,0)`
      )
      .bind(recipeId)
  );

  // Execute as a mini-transaction
  try {
    await env.DB.batch([
      env.DB.prepare("BEGIN"),
      ...statements,
      env.DB.prepare("COMMIT"),
    ]);
  } catch (e) {
    // Try to rollback on error
    try { await env.DB.batch([env.DB.prepare("ROLLBACK")]); } catch {}
    const msg = (e as any)?.message || "Import failed";
    return new Response(msg, { status: 500 });
  }

  // Return minimal info to the client
  return new Response(
    JSON.stringify({
      id: recipeId,
      title: normalized.title,
      category: finalCategory,
      source: normalized.external_source,
      external_id: normalized.external_id,
      updated: !!sel?.id
    }),
    { headers: { "content-type": "application/json" } }
  );
};
