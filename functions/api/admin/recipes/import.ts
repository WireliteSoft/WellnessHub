// functions/api/admin/recipes/import.ts
import { requireUser, requireAdmin } from "../../../_utils/auth";

type Meal = {
  idMeal: string;
  strMeal: string;
  strCategory: string | null;
  strInstructions: string | null;
  strMealThumb: string | null;
  [k: `strIngredient${number}`]: string | undefined;
  [k: `strMeasure${number}`]: string | undefined;
};

const SOURCE = "themealdb";

function mapCategory(c?: string | null) {
  const v = (c || "").toLowerCase();
  if (v === "breakfast") return "breakfast";
  if (v === "lunch") return "lunch";
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
    if (name) out.push({ name, quantity: qty || undefined });
  }
  return out;
}

function splitSteps(instructions: string | null | undefined) {
  if (!instructions) return [];
  const lines = instructions.split(/\r?\n+/).map(s => s.trim()).filter(Boolean);
  if (lines.length > 1) return lines;
  return instructions
    .split(/\.\s+/)
    .map(s => s.replace(/\.+$/, "").trim())
    .filter(Boolean);
}

// Quick schema sanity (helps when prod DB missed migrations)
async function assertSchema(env: any) {
  const cols = await env.DB.prepare(
    `PRAGMA table_info('recipes');`
  ).all();

  const names = new Set((cols.results ?? []).map((r: any) => r.name));
  const need = ["external_source", "external_id"];
  const missing = need.filter(n => !names.has(n));
  if (missing.length) {
    throw new Error(
      `recipes table missing columns: ${missing.join(", ")}. ` +
      `Run:\nALTER TABLE recipes ADD COLUMN external_source TEXT;\n` +
      `ALTER TABLE recipes ADD COLUMN external_id TEXT;\n` +
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_recipes_external ON recipes(external_source, external_id);`
    );
  }
}

export const onRequestPost: PagesFunction = async ({ env, request }) => {
  try {
    const user = await requireUser(env as any, request);
    requireAdmin(user);
    await assertSchema(env);

    const { url, limit } = await request.json().catch(() => ({} as any));
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "Missing or invalid 'url'." }), { status: 400, headers: { "content-type": "application/json" } });
    }

    // Fetch upstream with guard around non-JSON failures
    const upstream = await fetch(url, { cf: { cacheTtl: 120 } });
    const ct = upstream.headers.get("content-type") || "";
    if (!upstream.ok) {
      const body = ct.includes("application/json") ? await upstream.text() : (await upstream.text()).slice(0, 400);
      return new Response(JSON.stringify({ error: `Upstream returned ${upstream.status}`, body }), {
        status: 502, headers: { "content-type": "application/json" }
      });
    }

    let payload: any;
    try { payload = await upstream.json(); }
    catch (e: any) {
      const text = await upstream.text();
      return new Response(JSON.stringify({ error: "Upstream not JSON", body: text.slice(0, 400) }), {
        status: 502, headers: { "content-type": "application/json" }
      });
    }

    let meals: Meal[] = Array.isArray(payload?.meals) ? payload.meals : [];
    const max = Number.isFinite(limit) ? Math.max(0, Math.min(+limit, meals.length)) : meals.length;
    meals = meals.slice(0, max);

    if (meals.length === 0) {
      return new Response(JSON.stringify({ ok: true, succeeded: 0, failed: 0, inserted: 0, updated: 0 }), {
        headers: { "content-type": "application/json" },
      });
    }

    let succeeded = 0, failed = 0, inserted = 0, updated = 0;

    for (const meal of meals) {
      const external_id = meal.idMeal;
      const title = meal.strMeal?.trim() || "Untitled";
      const category = mapCategory(meal.strCategory);
      const description = "";
      const image_url = meal.strMealThumb || null;
      const ingredients = extractIngredients(meal);
      const steps = splitSteps(meal.strInstructions);

      try {
        // Upsert recipe by (external_source, external_id)
        const rec = await env.DB.prepare(
          `INSERT INTO recipes
            (id, title, category, description, image_url, created_by, is_public, published, created_at, updated_at, external_source, external_id)
           VALUES (?, ?, ?, ?, ?, ?, 1, 1, datetime('now'), datetime('now'), ?, ?)
           ON CONFLICT(external_source, external_id) DO UPDATE SET
             title=excluded.title,
             category=excluded.category,
             description=excluded.description,
             image_url=excluded.image_url,
             updated_at=datetime('now')
           RETURNING id;`
        ).bind(
          crypto.randomUUID(), title, category, description, image_url, user.id, SOURCE, external_id
        ).first<{ id: string }>();

        const recipeId = rec!.id;

        // Upsert nutrition (MealDB has no macros)
        await env.DB.prepare(
          `INSERT INTO recipe_nutrition (recipe_id, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg)
           VALUES (?, 0, 0, 0, 0, 0, 0, 0)
           ON CONFLICT(recipe_id) DO NOTHING`
        ).bind(recipeId).run();

        // Replace ingredients + steps
        const batch: D1PreparedStatement[] = [];
        batch.push(env.DB.prepare(`DELETE FROM recipe_ingredients WHERE recipe_id=?`).bind(recipeId));
        batch.push(env.DB.prepare(`DELETE FROM recipe_steps       WHERE recipe_id=?`).bind(recipeId));

        ingredients.forEach((ing, i) => {
          batch.push(
            env.DB.prepare(
              `INSERT INTO recipe_ingredients (id, recipe_id, name, quantity, position) VALUES (?, ?, ?, ?, ?)`
            ).bind(crypto.randomUUID(), recipeId, ing.name, ing.quantity ?? null, i + 1)
          );
        });
        steps.forEach((t, i) => {
          batch.push(
            env.DB.prepare(
              `INSERT INTO recipe_steps (id, recipe_id, step_no, text) VALUES (?, ?, ?, ?)`
            ).bind(crypto.randomUUID(), recipeId, i + 1, t)
          );
        });

        if (batch.length) await env.DB.batch(batch);

        // Rough insert/update counters
        const existed = await env.DB.prepare(
          `SELECT 1 FROM recipe_ingredients WHERE recipe_id=? LIMIT 1`
        ).bind(recipeId).first<any>();
        if (existed) updated++; else inserted++;

        succeeded++;
      } catch (e) {
        failed++;
        // Continue processing others; errors get surfaced in response counters
      }
    }

    return new Response(JSON.stringify({ ok: true, succeeded, failed, inserted, updated }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e: any) {
    const msg = e?.message || "Server error";
    const status = /unauthor/i.test(msg) ? 401 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status, headers: { "content-type": "application/json" }
    });
  }
};
