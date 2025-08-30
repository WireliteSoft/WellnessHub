import { requireUser, requireAdmin } from "../../../_utils/auth";

type Env = { DB: D1Database };

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json; charset=utf-8", ...init.headers },
  });
}

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const me = await requireUser(env as any, request);
  requireAdmin(me);

  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || 50)));
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));
  const search = (url.searchParams.get("search") || "").trim();

  const where = search ? "WHERE (u.email LIKE ? OR u.name LIKE ?)" : "";
  const binds = search ? [`%${search}%`, `%${search}%`, limit, offset] : [limit, offset];

  const sql = `
    SELECT
      u.id, u.email, u.name, u.is_admin, u.is_nutritionist, u.created_at,
      COALESCE(b.balance_cents, 0) AS balance_cents,
      (
        SELECT COUNT(*) FROM subscriptions s
        WHERE s.user_id = u.id AND s.status IN ('trialing','active','past_due')
      ) AS active_subscriptions
    FROM users u
    LEFT JOIN user_balances b ON b.user_id = u.id
    ${where}
    ORDER BY u.created_at DESC
    LIMIT ? OFFSET ?`;

  const rs = search
    ? await env.DB.prepare(sql).bind(...binds).all()
    : await env.DB.prepare(sql).bind(limit, offset).all();

  return json(rs.results ?? []);
};
