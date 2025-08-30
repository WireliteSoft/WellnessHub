// functions/api/admin/users/index.ts
import { requireUser, requireAdmin } from "../../../_utils/auth";

export const onRequestGet: PagesFunction = async ({ env, request }) => {
  const me = await requireUser(env as any, request);
  requireAdmin(me);

  const url = new URL(request.url);
  const search = (url.searchParams.get("search") || "").trim();
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 200);

  const like = `%${search}%`;
  const where = search ? "WHERE u.email LIKE ?1 OR u.name LIKE ?1" : "";

  const sql = `
    SELECT u.id, u.email, u.name, u.is_admin, u.is_nutritionist, u.created_at,
           COALESCE(b.balance_cents, 0) AS balance_cents,
           (
             SELECT COUNT(*) FROM subscriptions s
             WHERE s.user_id = u.id AND s.status IN ('trialing','active','past_due')
           ) AS active_subscriptions
    FROM users u
    LEFT JOIN user_balances b ON b.user_id = u.id
    ${where}
    ORDER BY datetime(u.created_at) DESC
    LIMIT ?2
  `;

  const stmt = search
    ? env.DB.prepare(sql).bind(like, limit)
    : env.DB.prepare(sql.replace("?1", "?2")).bind(limit); // keep param order sane

  const { results } = await stmt.all();
  return new Response(JSON.stringify(results ?? []), {
    headers: { "content-type": "application/json" },
  });
};
