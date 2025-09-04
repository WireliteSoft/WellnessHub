// functions/api/admin/recipes/import.ts
import { requireUser, requireAdmin } from "../../../_utils/auth";

// ---- Helpers ---------------------------------------------------------------

type Meal = {
  idMeal: string;
  strMeal: string;
  strCategory?: string | null;
  strInstructions?: string | null;
  strMealThumb?: string | null;
  // ingredients/measures 1..20
  [k: `strIngredient${number}`]: string | undefined;
  [k: `strMeasure${number}`]: string | undefined;
};

function mapCategory(raw?: string | null): "breakfast" | "lunch" | "dinner" | "snack" | "other" {
  const s = (raw || "").toLowerCase();
  if (s.includes("breakfast")) return "breakfast";
  if (s.includes("snack")) return "snack";
  // MealDB categories are things like "Beef", "Chicken", "Seafood", "Pasta"... not our enum.
  // Default most to "dinner" so they pass your CHECK constraint.
  return "dinner";
}

function splitInstructions(text?: string | null): string[] {
  if (!text) return [];
  // Split on blank lines or numbered steps, then trim empties
  const parts = text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n|^\s*\d+[\).\s-]+/gm)
    .map(s => s.trim())
    .filter(Boolean);

  // Fallback: split by single newlines if we ended up with only one big chunk
  if (parts.length <= 1) {
    const byLine = text
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map(s => s.trim())
      .filter(Boolean);
    if (byLine.length > 1) return byLine;
  }
  return parts;
}

function collectIngredients(meal: Meal): Array<{ name: string; quantity?: string; position: number }> {
  const out: Array<{ name: string; quantity?: string; position: number }> = [];
  for (let i = 1; i <= 20; i++) {
    const name = (meal as any)[`strIngredient${i}`]?.trim();
    const qty = (meal as any)[`strMeasure${i}`]?.trim();
    if (!name) continue;
    out.push({ name, quantity: qty || undefined, position: out.length });
  }
  return out;
}

async function insertOrUpdateRecipe(env: any, userId: string, meal: Meal) {
  const externalSource = "mealdb";
  const externalId = meal.idMeal;
  const title = meal.strMeal?.trim() || "Untitled";
  const category = mapCategory(meal.strCategory);
  const description = meal.strInstructions?.split(/\r?\n/)[0]?.trim() ?? null;
  const image = meal.strMealThumb || null;
  const ingredients = collectIngredients(meal);
  const steps = splitInstructions(meal.strInstructions);

  // Does it already exist?
  const existing = await env.DB
    .prepare(
      "SELECT id FROM recipes WHERE external_source=? AND external_id=? LIMIT 1"
    )
    .bind(externalSource, externalId)
    .first<{ id: string }>();

  const now = new Date().toISOString();

  if (!existing?.id) {
    // INSERT new
    const id = crypto.randomUUID();

    const ops = [
      env.DB.prepare(
        `INSERT INTO recipes
         (id, title, category, description, image_url, created_by, is_public, published,
          external_source, external_id, created_at, updated_at)
         VALUES (?,?,?,?,?,?,1,1,?,?,?,?)`
      ).bind(id, title, category, description, image, userId, externalSource, externalId, now, now),

      // nutrition: unknown from MealDB → zeros, so the UI still has fields
      env.DB.prepare(
        `INSERT INTO recipe_nutrition
         (recipe_id, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg)
         VALUES (?,?,?,?,?,?,?,?)`
      ).bind(id, 0, 0, 0, 0, 0, 0, 0),
    ];

    // ingredients
    for (const ing of ingredients) {
      ops.push(
        env.DB.prepare(
          `INSERT INTO recipe_ingredients (id, recipe_id, name, quantity, position)
           VALUES (?,?,?,?,?)`
        ).bind(crypto.randomUUID(), id, ing.name, ing.quantity ?? null, ing.position)
      );
    }

    // steps
    steps.forEach((text, i) => {
      ops.push(
        env.DB.prepare(
          `INSERT INTO recipe_steps (id, recipe_id, step_no, text)
           VALUES (?,?,?,?)`
        ).bind(crypto.randomUUID(), id, i + 1, text)
      );
    });

    await env.DB.batch(ops);
    return { id, action: "inserted" as const };
  } else {
    const rid = existing.id;

    // UPDATE recipe + replace ingredients/steps in a TX
    await env.DB.exec("BEGIN");
    try {
      await env.DB
        .prepare(
          `UPDATE recipes
           SET title=?, category=?, description=?, image_url=?, updated_at=?
           WHERE id=?`
        )
        .bind(title, category, description, image, now, rid)
        .run();

      await env.DB
        .prepare(`DELETE FROM recipe_ingredients WHERE recipe_id=?`)
        .bind(rid)
        .run();

      await env.DB
        .prepare(`DELETE FROM recipe_steps WHERE recipe_id=?`)
        .bind(rid)
        .run();

      const ops: D1PreparedStatement[] = [];
      for (const ing of ingredients) {
        ops.push(
          env.DB.prepare(
            `INSERT INTO recipe_ingredients (id, recipe_id, name, quantity, position)
             VALUES (?,?,?,?,?)`
          ).bind(crypto.randomUUID(), rid, ing.name, ing.quantity ?? null, ing.position)
        );
      }
      steps.forEach((text, i) => {
        ops.push(
          env.DB.prepare(
            `INSERT INTO recipe_steps (id, recipe_id, step_no, text)
             VALUES (?,?,?,?)`
          ).bind(crypto.randomUUID(), rid, i + 1, text)
        );
      });
      await env.DB.batch(ops);

      await env.DB.exec("COMMIT");
      return { id: rid, action: "updated" as const };
    } catch (e) {
      await env.DB.exec("ROLLBACK");
      throw e;
    }
  }
}

// ---- Handler ---------------------------------------------------------------

export const onRequestPost: PagesFunction = async ({ env, request }) => {
  try {
    const user = await requireUser(env as any, request);
    requireAdmin(user);

    const { url, urls, limit } = (await request.json().catch(() => ({}))) as {
      url?: string;
      urls?: string[];
      limit?: number;
    };

    const targets = (urls && urls.length ? urls : url ? [url] : []).slice(0, 25);
    if (targets.length === 0) {
      return new Response(JSON.stringify({ error: "Provide 'url' or 'urls'." }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    let succeeded = 0;
    let failed = 0;
    let inserted = 0;
    let updated = 0;
    const details: Array<{ url: string; ok: boolean; count?: number; error?: string }> = [];

    for (const u of targets) {
      try {
        const resp = await fetch(u, { cf: { cacheTtl: 0 } });
        if (!resp.ok) throw new Error(`upstream ${resp.status}`);
        const data = await resp.json();

        // MealDB returns { meals: Meal[] | null }
        const meals: Meal[] = Array.isArray(data?.meals) ? data.meals : [];
        const capped = meals.slice(0, Math.max(1, Math.min(limit ?? meals.length, 50)));

        let thisInserted = 0;
        let thisUpdated = 0;

        for (const m of capped) {
          const res = await insertOrUpdateRecipe(env, user.id, m);
          if (res.action === "inserted") thisInserted++;
          else thisUpdated++;
        }

        succeeded++;
        inserted += thisInserted;
        updated += thisUpdated;
        details.push({ url: u, ok: true, count: capped.length });
      } catch (e: any) {
        failed++;
        details.push({ url: u, ok: false, error: e?.message || "import failed" });
      }
    }

    return new Response(
      JSON.stringify({ ok: true, succeeded, failed, inserted, updated, details }),
      { headers: { "content-type": "application/json" } }
    );
  } catch (e: any) {
    // Return error JSON instead of a Cloudflare 1101 HTML page
    return new Response(JSON.stringify({ error: e?.message || "Server error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};
