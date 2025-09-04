// functions/api/admin/recipes/index.ts
import { requireUser, requireAdmin } from "../../../_utils/auth";

export const onRequestGet: PagesFunction = async ({ env, request }) => {
  try {
    const me = await requireUser(env as any, request);
    requireAdmin(me);

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("search") || "").trim().toLowerCase();
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const like = `%${q}%`;
    const where = q ? "WHERE lower(r.title) LIKE ? OR lower(r.category) LIKE ?" : "";
    const binds = q ? [like, like, limit, offset] : [limit, offset];

    const sql = `
      SELECT
        r.id,
        r.title,
        r.category,
        r.created_at,
        COALESCE(rn.calories, 0)  AS calories,
        COALESCE(rn.protein_g, 0) AS protein_g,
        COALESCE(rn.carbs_g, 0)   AS carbs_g,
        COALESCE(rn.fat_g, 0)     AS fat_g,
        (SELECT COUNT(*) FROM recipe_ingredients ri WHERE ri.recipe_id = r.id) AS ingredient_count,
        (SELECT COUNT(*) FROM recipe_steps rs       WHERE rs.recipe_id = r.id) AS step_count
      FROM recipes r
      LEFT JOIN recipe_nutrition rn ON rn.recipe_id = r.id
      ${where}
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?;
    `;

    const res = await env.DB.prepare(sql).bind(...binds).all();
    return new Response(JSON.stringify(res.results ?? []), {
      headers: { "content-type": "application/json" },
    });
  } catch (e: any) {
    const msg = e?.message || "Server error";
    const status = /unauthor/i.test(msg) ? 401 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { "content-type": "application/json" },
    });
  }
};
