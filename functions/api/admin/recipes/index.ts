// functions/api/admin/recipes/index.ts
import { requireUser, requireAdmin } from "../../../_utils/auth";

export const onRequestGet: PagesFunction = async (ctx) => {
  try {
    const { env, request } = ctx;
    const user = await requireUser(env as any, request);
    requireAdmin(user);

    const url = new URL(request.url);
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get("limit") || "200", 10), 1),
      500
    );
    const search = (url.searchParams.get("search") || "").trim();

    // Minimal, safe query (works even if nutrition/steps/ingredients are empty)
    const sql = `
      SELECT
        r.id,
        r.title,
        r.category,
        r.description,
        r.image_url       AS image,
        r.is_public,
        r.published,
        r.created_at,
        r.updated_at,
        COALESCE(rn.calories, 0)  AS calories,
        COALESCE(rn.protein_g, 0) AS protein_g,
        COALESCE(rn.carbs_g, 0)   AS carbs_g,
        COALESCE(rn.fat_g, 0)     AS fat_g,
        (SELECT COUNT(*) FROM recipe_ingredients ri WHERE ri.recipe_id = r.id) AS ingredient_count,
        (SELECT COUNT(*) FROM recipe_steps       rs WHERE rs.recipe_id = r.id) AS step_count
      FROM recipes r
      LEFT JOIN recipe_nutrition rn ON rn.recipe_id = r.id
      WHERE 1=1
        ${search ? "AND (r.title LIKE ? OR r.category LIKE ?)" : ""}
      ORDER BY r.created_at DESC
      LIMIT ?
    `;
    const bind: any[] = [];
    if (search) {
      const s = `%${search}%`;
      bind.push(s, s);
    }
    bind.push(limit);

    const { results } = await env.DB.prepare(sql).bind(...bind).all();
    return new Response(JSON.stringify(results ?? []), {
      headers: { "content-type": "application/json" },
    });
  } catch (err: any) {
    console.error("GET /api/admin/recipes failed:", err);
    return new Response(
      JSON.stringify({
        error: err?.message || "Server error",
        stack: err?.stack,
      }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
};

export const onRequestDelete: PagesFunction = async (ctx) => {
  try {
    const { env, request } = ctx;
    const user = await requireUser(env as any, request);
    requireAdmin(user);

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return new Response(JSON.stringify({ error: "Missing id" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    // cascades will remove ingredients/steps if FK is set ON DELETE CASCADE
    const res = await env.DB.prepare("DELETE FROM recipes WHERE id = ?").bind(id).run();
    return new Response(
      JSON.stringify({ ok: true, changes: (res as any)?.meta?.changes ?? 0 }),
      { headers: { "content-type": "application/json" } }
    );
  } catch (err: any) {
    console.error("DELETE /api/admin/recipes failed:", err);
    return new Response(
      JSON.stringify({
        error: err?.message || "Server error",
        stack: err?.stack,
      }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
};
