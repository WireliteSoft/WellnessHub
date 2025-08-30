// functions/api/admin/recipes/index.ts
import { requireUser, requireAdmin } from "../../_utils/auth";

export const onRequestGet: PagesFunction = async ({ env, request }) => {
  try {
    const user = await requireUser(env as any, request);
    requireAdmin(user);

    const url = new URL(request.url);
    const rawLimit = Number(url.searchParams.get("limit") || 100);
    const limit = Math.max(1, Math.min(500, isFinite(rawLimit) ? rawLimit : 100));
    const search = (url.searchParams.get("search") || "").trim().toLowerCase();
    const debug = url.searchParams.get("debug") === "1";

    // Build SQL with optional search; use subqueries for counts to avoid GROUP issues.
    let sql = `
      SELECT
        r.id,
        r.title,
        r.category,
        r.published,
        r.is_public,
        r.created_at,
        r.updated_at,
        COALESCE(rn.calories, 0)   AS calories,
        COALESCE(rn.protein_g, 0)  AS protein_g,
        COALESCE(rn.carbs_g, 0)    AS carbs_g,
        COALESCE(rn.fat_g, 0)      AS fat_g,
        (SELECT COUNT(*) FROM recipe_ingredients ri WHERE ri.recipe_id = r.id) AS ingredient_count,
        (SELECT COUNT(*) FROM recipe_steps rs WHERE rs.recipe_id = r.id)       AS step_count
      FROM recipes r
      LEFT JOIN recipe_nutrition rn ON rn.recipe_id = r.id
    `;

    const binds: unknown[] = [];
    if (search) {
      sql += `
        WHERE
          LOWER(r.title)       LIKE ?
          OR LOWER(COALESCE(r.description, '')) LIKE ?
          OR LOWER(r.category) LIKE ?
      `;
      const like = `%${search}%`;
      binds.push(like, like, like);
    }

    sql += ` ORDER BY r.created_at DESC LIMIT ?;`;
    binds.push(limit);

    const res = await env.DB.prepare(sql).bind(...binds).all();
    const rows = (res.results ?? []).map((r: any) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      published: r.published ? 1 : 0,
      is_public: r.is_public ? 1 : 0,
      created_at: r.created_at,
      updated_at: r.updated_at,
      calories: r.calories ?? 0,
      protein_g: r.protein_g ?? 0,
      carbs_g: r.carbs_g ?? 0,
      fat_g: r.fat_g ?? 0,
      ingredient_count: r.ingredient_count ?? 0,
      step_count: r.step_count ?? 0,
    }));

    return new Response(JSON.stringify(rows), {
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  } catch (err: any) {
    // Normalize auth errors vs server errors
    const msg = String(err?.message || "");
    const isAuth =
      msg.toLowerCase().includes("unauthorized") ||
      msg.toLowerCase().includes("forbidden") ||
      msg.toLowerCase().includes("admin");
    const status = isAuth ? 401 : 500;

    // If you append ?debug=1 (and you’re already admin) you’ll see the actual message
    const body =
      status === 401
        ? { error: "Unauthorized" }
        : { error: "Server error", detail: msg };

    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }
};

// OPTIONAL: if your UI sends DELETE /api/admin/recipes with a JSON body {id: "..."},
// keep this in index.ts. If your UI calls /api/admin/recipes/:id, put the same logic
// in functions/api/admin/recipes/[id].ts as onRequestDelete.
export const onRequestDelete: PagesFunction = async ({ env, request }) => {
  try {
    const user = await requireUser(env as any, request);
    requireAdmin(user);

    const body = await request.json().catch(() => null);
    const id = body?.id ? String(body.id) : null;
    if (!id) return new Response(JSON.stringify({ error: "Missing id" }), { status: 400 });

    // Delete children first to satisfy FKs; D1 supports batch.
    await env.DB.batch([
      env.DB.prepare(`DELETE FROM recipe_ingredients WHERE recipe_id = ?`).bind(id),
      env.DB.prepare(`DELETE FROM recipe_steps       WHERE recipe_id = ?`).bind(id),
      env.DB.prepare(`DELETE FROM recipe_nutrition   WHERE recipe_id = ?`).bind(id),
      env.DB.prepare(`DELETE FROM recipes            WHERE id = ?`).bind(id),
    ]);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
    });
  } catch (err: any) {
    const msg = String(err?.message || "");
    const isAuth =
      msg.toLowerCase().includes("unauthorized") ||
      msg.toLowerCase().includes("forbidden") ||
      msg.toLowerCase().includes("admin");
    return new Response(JSON.stringify({ error: isAuth ? "Unauthorized" : "Server error", detail: msg }), {
      status: isAuth ? 401 : 500,
      headers: { "content-type": "application/json" },
    });
  }
};
