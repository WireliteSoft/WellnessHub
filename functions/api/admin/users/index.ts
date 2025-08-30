// functions/api/admin/users/index.ts
import { requireUser, requireAdmin } from "../../../_utils/auth";

export const onRequestGet: PagesFunction = async ({ env, request }) => {
  try {
    const me = await requireUser(env as any, request);
    requireAdmin(me);

    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200);
    const search = (url.searchParams.get("search") || "").trim();
    const like = `%${search}%`;

    const sql = `
      SELECT
        u.id, u.email, u.name, u.is_admin, u.is_nutritionist, u.created_at,
        COALESCE(b.balance_cents, 0) AS balance_cents,
        (
          SELECT COUNT(*)
          FROM subscriptions s
          WHERE s.user_id = u.id
            AND s.status IN ('trialing','active','past_due')
        ) AS active_subscriptions
      FROM users u
      LEFT JOIN user_balances b ON b.user_id = u.id
      WHERE (? = '' OR u.email LIKE ? OR IFNULL(u.name,'') LIKE ?)
      ORDER BY u.created_at DESC
      LIMIT ?
    `;

    const { results } = await env.DB.prepare(sql).bind(search, like, like, limit).all();
    return new Response(JSON.stringify(results ?? []), {
      headers: { "content-type": "application/json" },
    });
  } catch (e: any) {
    if (e instanceof Response) return e; // from requireUser/requireAdmin
    return new Response(JSON.stringify({ error: "server_error", detail: String(e?.message || e) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};
