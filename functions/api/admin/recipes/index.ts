import { requireUser, requireAdmin } from "../../../_utils/auth";

export const onRequestGet: PagesFunction = async ({ env, request }) => {
  const user = await requireUser(env as any, request);
  requireAdmin(user);

  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit")) || 100, 500));
  const search = (url.searchParams.get("search") || "").trim();
  const like = `%${search}%`;

  const sql = `
    SELECT
      r.id,
      r.title,
      r.category,
      r.is_public,
      r.published,
      r.created_at,
      u.email AS created_by_email,
      (SELECT COUNT(*) FROM recipe_ingredients i WHERE i.recipe_id = r.id) AS ingredient_count,
      (SELECT COUNT(*) FROM recipe_steps s WHERE s.recipe_id = r.id) AS step_count
    FROM recipes r
    LEFT JOIN users u ON u.id = r.created_by
    WHERE (? = '' OR r.title LIKE ? OR r.category LIKE ?)
    ORDER BY r.created_at DESC
    LIMIT ?;
  `;

  const rs = await env.DB.prepare(sql).bind(search, like, like, limit).all();
  return new Response(JSON.stringify(rs.results ?? []), {
    headers: { "content-type": "application/json" },
  });
};
