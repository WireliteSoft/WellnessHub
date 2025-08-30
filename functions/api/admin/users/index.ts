import { requireUser, requireAdmin } from "../../../_utils/auth";

// GET /api/admin/users?search=&limit=50
export const onRequestGet: PagesFunction = async ({ env, request }) => {
  const me = await requireUser(env as any, request);
  requireAdmin(me);

  const url = new URL(request.url);
  const search = (url.searchParams.get("search") || "").trim();
  const limitRaw = url.searchParams.get("limit");
  const limit = Math.max(1, Math.min(parseInt(limitRaw || "50", 10) || 50, 200));
  const like = `%${search}%`;

  try {
    // Minimal query: users table only (no views/joins)
    const stmt = search
      ? env.DB.prepare(
          `
          SELECT
            u.id, u.email, u.name, u.is_admin, u.is_nutritionist, u.created_at,
            0 AS balance_cents,
            0 AS active_subscriptions
          FROM users u
          WHERE u.email LIKE ? OR (u.name IS NOT NULL AND u.name LIKE ?)
          ORDER BY u.created_at DESC
          LIMIT ?
        `,
        ).bind(like, like, limit)
      : env.DB.prepare(
          `
          SELECT
            u.id, u.email, u.name, u.is_admin, u.is_nutritionist, u.created_at,
            0 AS balance_cents,
            0 AS active_subscriptions
          FROM users u
          ORDER BY u.created_at DESC
          LIMIT ?
        `,
        ).bind(limit);

    const { results } = await stmt.all();
    return new Response(JSON.stringify(results ?? []), {
      headers: { "content-type": "application/json" },
    });
  } catch (err: any) {
    // Return JSON, not HTML, on error
    return new Response(JSON.stringify({ error: "query_failed", detail: String(err?.message || err) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};
