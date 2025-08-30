// List recipes for admins with counts, macros, created-by, search
import { requireUser, requireAdmin } from "../../../_utils/auth";

export const onRequestGet: PagesFunction = async ({ env, request }) => {
  const user = await requireUser(env as any, request);
  requireAdmin(user);

  const url = new URL(request.url);
  const search = (url.searchParams.get("search") || "").trim();
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "100", 10), 1), 500);

  const rows = await env.DB
    .prepare(
      `
      SELECT
        r.id,
        r.title,
        r.category,
        r.description,
        r.image_url                    AS image,
        r.is_public,
        r.published,
        r.created_at,
        u.email                        AS created_by_email,
        COALESCE(n.calories, 0)        AS calories,
        COALESCE(n.protein_g, 0)       AS protein_g,
        COALESCE(n.carbs_g, 0)         AS carbs_g,
        COALESCE(n.fat_g, 0)           AS fat_g,
        (SELECT COUNT(*) FROM recipe_ingredients ri WHERE ri.recipe_id = r.id) AS ingredient_count,
        (SELECT COUNT(*) FROM recipe_steps rs WHERE rs.recipe_id = r.id)       AS step_count
      FROM recipes r
      LEFT JOIN users u ON u.id = r.created_by
      LEFT JOIN recipe_nutrition n ON n.recipe_id = r.id
      WHERE
        (? = '' OR r.title LIKE ? OR r.category LIKE ?)
      ORDER BY r.created_at DESC
      LIMIT ?
      `
    )
    .bind(
      search,
      `%${search}%`,
      `%${search}%`,
      limit
    )
    .all();

  return new Response(JSON.stringify(rows.results ?? []), {
    headers: { "content-type": "application/json" },
  });
};
