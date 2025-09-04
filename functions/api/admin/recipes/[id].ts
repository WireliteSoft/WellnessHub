// functions/api/admin/recipes/[id].ts
import { requireUser, requireAdmin } from "../../../_utils/auth";

type PatchBody = {
  // optional top-level fields
  title?: string;
  category?: "breakfast" | "lunch" | "dinner" | "snack" | "other";
  description?: string | null;
  image?: string | null; // maps to recipes.image_url
  published?: boolean;
  is_public?: boolean;

  // optional nutrition bundle
  nutrition?: {
    calories?: number | null;
    protein_g?: number | null;
    carbs_g?: number | null;
    fat_g?: number | null;
    fiber_g?: number | null;
    sugar_g?: number | null;
    sodium_mg?: number | null;
  };
};

// PATCH /api/admin/recipes/:id  -> update recipe + upsert nutrition
export const onRequestPatch: PagesFunction = async ({ env, request, params }) => {
  const user = await requireUser(env as any, request);
  requireAdmin(user);

  const id = String(params?.id || "").trim();
  if (!id) return new Response("Missing id", { status: 400 });

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const stmts: D1PreparedStatement[] = [];

  // recipe patch
  const recipeSets: string[] = [];
  const binds: any[] = [];

  const pushSet = (fragment: string, value: any) => {
    recipeSets.push(fragment);
    binds.push(value);
  };

  if (typeof body.title === "string") pushSet("title = ?", body.title.trim());
  if (body.category) pushSet("category = ?", body.category);
  if (body.description !== undefined) pushSet("description = ?", body.description ?? null);
  if (body.image !== undefined) pushSet("image_url = ?", body.image ?? null);
  if (typeof body.published === "boolean") pushSet("published = ?", body.published ? 1 : 0);
  if (typeof body.is_public === "boolean") pushSet("is_public = ?", body.is_public ? 1 : 0);

  if (recipeSets.length) {
    pushSet("updated_at = datetime('now')", undefined);
    // last value had no ?, remove the undefined bind we just pushed:
    binds.pop();

    const sql = `UPDATE recipes SET ${recipeSets.join(", ")} WHERE id = ?`;
    stmts.push(env.DB.prepare(sql).bind(...binds, id));
  }

  // nutrition upsert (only if provided)
  if (body.nutrition) {
    const n = body.nutrition;
    // We’ll coalesce to 0 when null/undefined to keep things simple
    const cal  = n.calories   ?? 0;
    const pro  = n.protein_g  ?? 0;
    const carb = n.carbs_g    ?? 0;
    const fat  = n.fat_g      ?? 0;
    const fib  = n.fiber_g    ?? 0;
    const sug  = n.sugar_g    ?? 0;
    const sod  = n.sodium_mg  ?? 0;

    const sql = `
      INSERT INTO recipe_nutrition
        (recipe_id, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(recipe_id) DO UPDATE SET
        calories   = excluded.calories,
        protein_g  = excluded.protein_g,
        carbs_g    = excluded.carbs_g,
        fat_g      = excluded.fat_g,
        fiber_g    = excluded.fiber_g,
        sugar_g    = excluded.sugar_g,
        sodium_mg  = excluded.sodium_mg
    `;
    stmts.push(
      env.DB.prepare(sql).bind(id, cal, pro, carb, fat, fib, sug, sod)
    );
  }

  if (!stmts.length) {
    return new Response(JSON.stringify({ ok: true, noop: true }), {
      headers: { "content-type": "application/json" },
    });
  }

  await env.DB.batch(stmts);
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json" },
  });
};

// (Optional) Keep DELETE here so Manage Recipes can remove rows by id
export const onRequestDelete: PagesFunction = async ({ env, request, params }) => {
  const user = await requireUser(env as any, request);
  requireAdmin(user);

  const id = String(params?.id || "");
  if (!id) return new Response("Missing id", { status: 400 });

  const stmts = [
    env.DB.prepare("DELETE FROM recipe_ingredients WHERE recipe_id = ?").bind(id),
    env.DB.prepare("DELETE FROM recipe_steps       WHERE recipe_id = ?").bind(id),
    env.DB.prepare("DELETE FROM recipe_nutrition   WHERE recipe_id = ?").bind(id),
    env.DB.prepare("DELETE FROM recipes            WHERE id = ?").bind(id),
  ];
  await env.DB.batch(stmts);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json" },
  });
};
