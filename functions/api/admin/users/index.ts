// functions/api/admin/users/index.ts
import { requireUser, requireAdmin } from "../../../_utils/auth";

export const onRequestGet: PagesFunction = async ({ env, request }) => {
  const user = await requireUser(env as any, request);
  requireAdmin(user);

  const url = new URL(request.url);
  const search = (url.searchParams.get("search") || "").trim();
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || 50)));

  // LIKE parameters; empty search matches all
  const like = `%${search}%`;

  const rows = await env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.is_admin, u.is_nutritionist, u.created_at,
            COALESCE(b.balance_cents,0) AS balance_cents,
            COALESCE(SUM(CASE WHEN s.status IN ('trialing','active','past_due','paused') THEN 1 ELSE 0 END),0) AS active_subscriptions
       FROM users u
  LEFT JOIN user_balances b ON b.user_id = u.id
  LEFT JOIN subscriptions s ON s.user_id = u.id
      WHERE (? = '' OR u.email LIKE ? OR u.name LIKE ?)
   GROUP BY u.id
   ORDER BY u.created_at DESC
      LIMIT ?`
  ).bind(search, like, like, limit).all();

  return new Response(JSON.stringify(rows.results ?? []), {
    headers: { "content-type": "application/json" },
  });
};
