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

const SOURCE = "themealdb" as const;

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

async function ensureExternalCols(env: any) {
  // Ensure the columns exist (prod D1 can be behind local sometimes)
  const info = await env.DB.prepare(`PRAGMA table_info('recipes')`).all();
  const cols = new Set((info.results ?? []).map((r: any) => r.name));
  const missing: string[] = [];
  if (!cols.has("external_source")) missing.push("external_source");
  if (!cols.has("external_id")) missing.push("external_id");
  if (missing.length) {
    throw new Error(
      `recipes missing ${missing.join(", ")}. Run:\n` +
      `ALTER TABLE recipes ADD COLUMN external_source TEXT;\n` +
      `ALTER TABLE recipes ADD COLUMN external_id TEXT;\n` +
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_recipes_external ON recipes(external_source, external_id);`
    );
  }
}

export const onRequestPost: PagesFunction = async ({ env, request }) => {
  try {
    const user = await requireUser(env as any, request);
    requireAdmin(user);
    await ensureExternalCols(env);

    const body = await request.json().catch(() => ({}));
    const url: string = body.url;
    const limit: number | undefined = body.limit;

    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "Missing or invalid 'url'." }), {
        status: 400, headers: { "content-type": "application/json" },
      });
    }

    const upstream = await fetch(url, { cf: { cacheTtl: 120 } });
    const ct = upstream.headers.get("content-type") || "";
    if (!upstream.ok) {
      const txt = await upstream.text();
      return new Response(JSON.stringify({ error: `Upstream ${upstream.status}`, body: txt.slice(0, 600) }), {
        status: 502, headers: { "content-type": "application/json" },
      });
    }
    if (!ct.includes("application/json")) {
      const txt = await upstream.text();
      return new Response(JSON.stringify({ error: "Upstream not JSON", body: txt.slice(0, 600) }), {
        status: 502, headers: { "content-type": "application/json" },
      });
    }

    const payload = await upstream.json();
    let meals: Meal[] = Array.isArray(payload?.meals) ? payload.meals : [];
    if (typeof limit === "number" && limit >= 0) meals = meals.slice(0, limit);

    let succeeded = 0, failed = 0, inserted = 0, updated = 0;
    const errors: Array<{ external_id: string; title?: string; reason: string }> = [];

    for (const m of meals) {
      const external_id = m.idMeal;
      try {
        const title = m.strMeal?.trim() || "Untitled";
        const category = mapCategory(m.strCategory);
        const description = ""; // MealDB doesn’t provide a great summary; keep blank
        const image_url = m.strMealThumb || null;
        const ingredients = extractIngredients(m);
        const steps = splitSteps(m.strInstructions);

        // 1) Does a recipe already exist for (source, id)?
        const existing = await env.DB.prepare(
          `SELECT id FROM recipes WHERE external_source=? AND external_id=? LIMIT 1`
        ).bind(SOURCE, external_id).first<{ id: string }>();

        let recipeId = existing?.id;

        if (!recipeId) {
          // 2) Insert new recipe
          recipeId = crypto.randomUUID();
          await env.DB.prepare(
            `INSERT INTO recipes
             (id, title, category, description, image_url, created_by, is_public, published, created_at, updated_at, external_source, external_id)
             VALUES (?, ?, ?, ?, ?, ?, 1, 1, datetime('now'), datetime('now'), ?, ?)`
          ).bind(
            recipeId, title, category, description, image_url, user.id, SOURCE, external_id
          ).run();
          inserted++;
        } else {
          // 3) Update existing shell
          await env.DB.prepare(
            `UPDATE recipes
               SET title=?, category=?, description=?, image_url=?, updated_at=datetime('now')
             WHERE id=?`
          ).bind(title, category, description, image_url, recipeId).run();
          updated++;
        }

        // 4) Nutrition (MealDB lacks macros → zeros if not present)
        await env.DB.prepare(
          `INSERT OR IGNORE INTO recipe_nutrition
             (recipe_id, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg)
           VALUES (?, 0, 0, 0, 0, 0, 0, 0)`
        ).bind(recipeId).run();

        // 5) Replace ingredients & steps
        const batch: D1PreparedStatement[] = [];
        batch.push(env.DB.prepare(`DELETE FROM recipe_ingredients WHERE recipe_id=?`).bind(recipeId));
        batch.push(env.DB.prepare(`DELETE FROM recipe_steps       WHERE recipe_id=?`).bind(recipeId));

        ingredients.forEach((ing, i) => {
          batch.push(
            env.DB
              .prepare(`INSERT INTO recipe_ingredients (id, recipe_id, name, quantity, position) VALUES (?, ?, ?, ?, ?)`)
              .bind(crypto.randomUUID(), recipeId, ing.name, ing.quantity ?? null, i + 1)
          );
        });
        steps.forEach((t, i) => {
          batch.push(
            env.DB
              .prepare(`INSERT INTO recipe_steps (id, recipe_id, step_no, text) VALUES (?, ?, ?, ?)`)
              .bind(crypto.randomUUID(), recipeId, i + 1, t)
          );
        });
        if (batch.length) await env.DB.batch(batch);

        succeeded++;
      } catch (e: any) {
        failed++;
        errors.push({ external_id, title: m?.strMeal, reason: e?.message || String(e) });
        // continue with next meal
      }
    }

    return new Response(JSON.stringify({ ok: true, succeeded, failed, inserted, updated, errors }), {
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
