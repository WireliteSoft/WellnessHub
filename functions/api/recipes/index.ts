// functions/api/recipes/index.ts
import { requireUser, requireAdmin } from "../../_utils/auth";

type Env = { DB: D1Database };

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...init.headers,
    },
  });
}

/**
 * GET /api/recipes
 * Returns public+published recipes, fully shaped for the frontend:
 * {
 *   id, title, category, description, image, createdAt, updatedAt,
 *   ingredients: [{id,name,quantity}],
 *   instructions: string[],
 *   nutrition: { calories, protein, carbs, fat, fiber, sugar, sodium }
 * }
 */
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const base = await env.DB
    .prepare(
      `SELECT r.id, r.title, r.category, r.description, r.image_url,
              r.created_at, r.updated_at,
              n.calories, n.protein_g, n.carbs_g, n.fat_g, n.fiber_g, n.sugar_g, n.sodium_mg
         FROM recipes r
    LEFT JOIN recipe_nutrition n ON n.recipe_id = r.id
        WHERE r.is_public = 1 AND r.published = 1
     ORDER BY r.created_at DESC
        LIMIT 200`
    )
    .all();

  const out: any[] = [];
  for (const row of (base.results as any[]) ?? []) {
    const ings = await env.DB
      .prepare(
        `SELECT id, name, COALESCE(quantity,'') AS quantity
           FROM recipe_ingredients
          WHERE recipe_id = ?
       ORDER BY position ASC`
      )
      .bind(row.id)
      .all();

    const steps = await env.DB
      .prepare(
        `SELECT text
           FROM recipe_steps
          WHERE recipe_id = ?
       ORDER BY step_no ASC`
      )
      .bind(row.id)
      .all();

    out.push({
      id: row.id,
      title: row.title,
      category: row.category,
      description: row.description ?? "",
      image: row.image_url ?? undefined, // map to 'image' for UI
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      ingredients: (ings.results as any[]).map((i) => ({
        id: i.id,
        name: i.name,
        quantity: i.quantity ?? "",
      })),
      instructions: (steps.results as any[]).map((s) => s.text),
      nutrition: {
        calories: row.calories ?? 0,
        protein: row.protein_g ?? 0,
        carbs: row.carbs_g ?? 0,
        fat: row.fat_g ?? 0,
        fiber: row.fiber_g ?? 0,
        sugar: row.sugar_g ?? 0,
        sodium: row.sodium_mg ?? 0,
      },
    });
  }

  return json(out);
};

/**
 * POST /api/recipes  (admin only)
 * Accepts either NutritionFacts keys (protein, carbs, fat, fiber, sugar, sodium)
 * OR the DB-style keys (protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg).
 */
export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const user = await requireUser(env as any, request);
  requireAdmin(user);

  type In = {
    title: string;
    category: "breakfast" | "lunch" | "dinner" | "snack" | "other";
    description?: string;
    image?: string | null;
    ingredients: { name: string; quantity?: string }[];
    instructions: string[];
    nutrition?: {
      calories?: number;
      protein?: number; carbs?: number; fat?: number; fiber?: number; sugar?: number; sodium?: number;
      protein_g?: number; carbs_g?: number; fat_g?: number; fiber_g?: number; sugar_g?: number; sodium_mg?: number;
    };
  };

  let body: In | null = null;
  try {
    body = (await request.json()) as In;
  } catch {
    // no-op
  }
  if (!body?.title || !body?.category) return new Response("bad request", { status: 400 });

  const rid = crypto.randomUUID();

  const stmts: D1PreparedStatement[] = [];

  // recipe
  stmts.push(
    env.DB
      .prepare(
        `INSERT INTO recipes
         (id,title,category,description,image_url,created_by,is_public,published,created_at,updated_at)
         VALUES (?,?,?,?,?,?,1,1,datetime('now'),datetime('now'))`
      )
      .bind(
        rid,
        body.title.trim(),
        body.category,
        body.description ?? null,
        body.image ?? null,
        user.id
      )
  );

  // nutrition (accept both key styles)
  if (body.nutrition) {
    const n = body.nutrition;
    const calories = n.calories ?? 0;
    const protein_g = (n.protein_g ?? n.protein) ?? 0;
    const carbs_g = (n.carbs_g ?? n.carbs) ?? 0;
    const fat_g = (n.fat_g ?? n.fat) ?? 0;
    const fiber_g = (n.fiber_g ?? n.fiber) ?? 0;
    const sugar_g = (n.sugar_g ?? n.sugar) ?? 0;
    const sodium_mg = (n.sodium_mg ?? n.sodium) ?? 0;

    stmts.push(
      env.DB
        .prepare(
          `INSERT INTO recipe_nutrition
           (recipe_id,calories,protein_g,carbs_g,fat_g,fiber_g,sugar_g,sodium_mg)
           VALUES (?,?,?,?,?,?,?,?)`
        )
        .bind(rid, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg)
    );
  }

  // ingredients
  (body.ingredients ?? []).forEach((ing, i) => {
    if (!ing.name?.trim()) return;
    stmts.push(
      env.DB
        .prepare(
          `INSERT INTO recipe_ingredients (id,recipe_id,name,quantity,position)
           VALUES (?,?,?,?,?)`
        )
        .bind(crypto.randomUUID(), rid, ing.name.trim(), ing.quantity ?? null, i)
    );
  });

  // steps
  (body.instructions ?? []).forEach((txt, i) => {
    if (!txt?.trim()) return;
    stmts.push(
      env.DB
        .prepare(
          `INSERT INTO recipe_steps (id,recipe_id,step_no,text)
           VALUES (?,?,?,?)`
        )
        .bind(crypto.randomUUID(), rid, i + 1, txt.trim())
    );
  });

  await env.DB.batch(stmts);

  // (Optional) return the shaped object directly; for now just the id.
  return json({ id: rid });
};
