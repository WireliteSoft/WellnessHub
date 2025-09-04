// functions/api/admin/recipes/import.ts
import { requireUser, requireAdmin } from "../../../_utils/auth";

type Meal = {
  idMeal: string;
  strMeal: string;
  strCategory: string | null;
  strInstructions: string | null;
  strMealThumb: string | null;
  // ingredients/measure come as 1..20 fields
  [k: `strIngredient${number}`]: string | undefined;
  [k: `strMeasure${number}`]: string | undefined;
};

const SOURCE = "themealdb";

/** Map MealDB category -> our MealCategory */
function mapCategory(c?: string | null) {
  const v = (c || "").toLowerCase();
  if (["breakfast"].includes(v)) return "breakfast";
  if (["lunch"].includes(v)) return "lunch";
  if (["dinner", "beef", "chicken", "seafood", "pork", "lamb", "vegan", "vegetarian", "miscellaneous"].includes(v))
    return "dinner";
  if (["side", "starter", "dessert"].includes(v)) return "snack";
  return "other";
}

function extractIngredients(m: Meal) {
  const out: { name: string; quantity?: string }[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = (m as any)[`strIngredient${i}`]?.trim();
    const qty = (m as any)[`strMeasure${i}`]?.trim();
    if (name) {
      out.push({ name, quantity: qty || undefined });
    }
  }
  return out;
}

function splitSteps(instructions: string | null | undefined) {
  if (!instructions) return [];
  // split by line breaks and dots; keep it simple & neat
  const parts = instructions
    .split(/\r?\n+/)
    .map(s => s.trim())
    .filter(Boolean);

  // if still just one blob, try to split by period+space
  if (parts.length <= 1) {
    return instructions
      .split(/\.\s+/)
      .map(s => s.replace(/\.+$/, "").trim())
      .filter(Boolean);
  }
  return parts;
}

export const onRequestPost: PagesFunction = async ({ env, request }) => {
  try {
    const user = await requireUser(env as any, request);
    requireAdmin(user);

    const { url, limit } = await request.json().catch(() => ({} as any));
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "Missing or invalid 'url'." }), { status: 400 });
    }

    // fetch the remote URL (MealDB)
    const resp = await fetch(url, { cf: { cacheTtl: 120, cacheEverything: false } });
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: `Upstream returned ${resp.status}` }), { status: 502 });
    }
    const data = await resp.json();

    // Normalize MealDB responses:
    // - lookup.php -> { meals: [ ... ] }
    // - search.php -> { meals: [ ... ] }
    let meals: Meal[] = Array.isArray(data?.meals) ? data.meals : [];
    if (limit && Number.isFinite(limit)) meals = meals.slice(0, Math.max(0, Math.min(+limit, meals.length)));

    if (meals.length === 0) {
      return new Response(JSON.stringify({ ok: true, succeeded: 0, failed: 0, inserted: 0, updated: 0 }), {
        headers: { "content-type": "application/json" },
      });
    }

    let succeeded = 0;
    let failed = 0;
    let inserted = 0;
    let updated = 0;

    for (const meal of meals) {
      const external_id = meal.idMeal;
      const title = meal.strMeal?.trim() || "Untitled";
      const category = mapCategory(meal.strCategory);
      const description = ""; // MealDB descriptions aren’t separate; we’ll leave this empty
      const image_url = meal.strMealThumb || null;
      const ingredients = extractIngredients(meal);
      const steps = splitSteps(meal.strInstructions);

      try {
        // 1) upsert recipe shell
        const r = await env.DB.prepare(
          `
          INSERT INTO recipes (id, title, category, description, image_url, created_by, is_public, published, created_at, updated_at, external_source, external_id)
          VALUES (?, ?, ?, ?, ?, ?, 1, 1, datetime('now'), datetime('now'), ?, ?)
          ON CONFLICT(external_source, external_id)
          DO UPDATE SET
            title      = excluded.title,
            category   = excluded.category,
            description= excluded.description,
            image_url  = excluded.image_url,
            updated_at = datetime('now')
          RETURNING id, (SELECT changes()) AS ch;
        `
        ).bind(
          crypto.randomUUID(),
          title,
          category,
          description,
          image_url,
          user.id,
          SOURCE,
          external_id
        ).first<any>();

        const recipeId = r?.id as string;
        const changes = Number(r?.ch || 0);
        if (changes === 1) {
          // Could be insert or update; we’ll check existence to decide
          // Quick existence check by external key:
          const exists = await env.DB
            .prepare(`SELECT id FROM recipes WHERE external_source=? AND external_id=?`)
            .bind(SOURCE, external_id)
            .first<any>();

          if (exists && exists.id === recipeId) {
            // We don’t know if it was insert or update from changes() reliably here across Pages,
            // use a tiny heuristic: if there were prior rows, it's update. Not critical—just counters.
            // We’ll increment inserted if no ingredients existed yet.
            const hasIngredients = await env.DB
              .prepare(`SELECT 1 FROM recipe_ingredients WHERE recipe_id=? LIMIT 1`)
              .bind(recipeId)
              .first<any>();
            if (hasIngredients) updated++;
            else inserted++;
          } else {
            inserted++;
          }
        }

        // 2) upsert nutrition (MealDB doesn’t provide macros; write zeros if absent)
        await env.DB.prepare(
          `
          INSERT INTO recipe_nutrition (recipe_id, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(recipe_id) DO UPDATE SET
            calories  = excluded.calories,
            protein_g = excluded.protein_g,
            carbs_g   = excluded.carbs_g,
            fat_g     = excluded.fat_g,
            fiber_g   = excluded.fiber_g,
            sugar_g   = excluded.sugar_g,
            sodium_mg = excluded.sodium_mg
        `
        ).bind(recipeId, 0, 0, 0, 0, 0, 0, 0).run();

        // 3) replace ingredients & steps
        const batch = [];

        batch.push(env.DB.prepare(`DELETE FROM recipe_ingredients WHERE recipe_id=?`).bind(recipeId));
        batch.push(env.DB.prepare(`DELETE FROM recipe_steps       WHERE recipe_id=?`).bind(recipeId));

        ingredients.forEach((ing, idx) => {
          batch.push(
            env.DB
              .prepare(
                `INSERT INTO recipe_ingredients (id, recipe_id, name, quantity, position) VALUES (?, ?, ?, ?, ?)`
              )
              .bind(crypto.randomUUID(), recipeId, ing.name, ing.quantity ?? null, idx + 1)
          );
        });

        steps.forEach((txt, idx) => {
          batch.push(
            env.DB
              .prepare(`INSERT INTO recipe_steps (id, recipe_id, step_no, text) VALUES (?, ?, ?, ?)`)
              .bind(crypto.randomUUID(), recipeId, idx + 1, txt)
          );
        });

        if (batch.length) await env.DB.batch(batch);

        succeeded++;
      } catch (e) {
        console.error("Import item failed:", e);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, succeeded, failed, inserted, updated }),
      { headers: { "content-type": "application/json" } }
    );
  } catch (e: any) {
    // auth failure OR unexpected error
    const msg = e?.message || "Server error";
    const code = /unauthorized|forbidden/i.test(msg) ? 401 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status: code,
      headers: { "content-type": "application/json" },
    });
  }
};
