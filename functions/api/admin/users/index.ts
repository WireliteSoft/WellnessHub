import { requireUser, requireAdmin } from "../../../_utils/auth";

// GET /api/admin/users?limit=50&search=foo
export const onRequestGet: PagesFunction = async ({ env, request }) => {
  const me = await requireUser(env as any, request);
  requireAdmin(me);

  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || "50")));
  const search = (url.searchParams.get("search") || "").trim();

  // Base SELECT with balance (view) + active subscription count
  const baseSQL = `
    SELECT
      u.id,
      u.email,
      u.name,
      u.is_admin,
      u.is_nutritionist,
      u.created_at,
      COALESCE(b.balance_cents, 0) AS balance_cents,
      COALESCE(s.active_subscriptions, 0) AS active_subscriptions
    FROM users u
    LEFT JOIN user_balances b ON b.user_id = u.id
    LEFT JOIN (
      SELECT user_id, COUNT(*) AS active_subscriptions
      FROM subscriptions
      WHERE status IN ('trialing','active','past_due')
      GROUP BY user_id
    ) s ON s.user_id = u.id
  `;

  let stmt: D1PreparedStatement;
  if (search) {
    const like = `%${search}%`;
    stmt = env.DB
      .prepare(`${baseSQL} WHERE u.email LIKE ? OR COALESCE(u.name,'') LIKE ? ORDER BY u.created_at DESC LIMIT ?`)
      .bind(like, like, limit);
  } else {
    stmt = env.DB
      .prepare(`${baseSQL} ORDER BY u.created_at DESC LIMIT ?`)
      .bind(limit);
  }

  const rows = await stmt.all();
  return new Response(JSON.stringify(rows.results ?? []), {
    headers: { "content-type": "application/json" },
  });
};
