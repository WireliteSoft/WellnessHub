import { requireUser, requireAdmin } from "../../../_utils/auth";

/**
 * GET /api/admin/users?limit=50&search=foo
 * Returns list of users with computed balance and active sub count.
 * Avoids depending on a VIEW so it works even if user_balances wasn't created.
 */
export const onRequestGet: PagesFunction = async ({ env, request }) => {
  const me = await requireUser(env as any, request);
  requireAdmin(me);

  try {
    const url = new URL(request.url);
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || "50")));
    const search = (url.searchParams.get("search") || "").trim();

    // Compute balance from ledger_entries and active subs from subscriptions.
    // (No dependency on the user_balances view.)
    const baseSQL = `
      SELECT
        u.id,
        u.email,
        u.name,
        u.is_admin,
        u.is_nutritionist,
        u.created_at,
        COALESCE((
          SELECT SUM(CASE WHEN le.direction = 'debit' THEN le.amount_cents ELSE -le.amount_cents END)
          FROM ledger_entries le
          WHERE le.user_id = u.id
        ), 0) AS balance_cents,
        COALESCE((
          SELECT COUNT(1)
          FROM subscriptions s
          WHERE s.user_id = u.id
            AND s.status IN ('trialing','active','past_due')
        ), 0) AS active_subscriptions
      FROM users u
    `;

    let sql = `${baseSQL}`;
    const binds: any[] = [];

    if (search) {
      sql += ` WHERE u.email LIKE ? OR COALESCE(u.name,'') LIKE ?`;
      const like = `%${search}%`;
      binds.push(like, like);
    }

    sql += ` ORDER BY u.created_at DESC LIMIT ?`;
    binds.push(limit);

    const rows = await env.DB.prepare(sql).bind(...binds).all();
    return new Response(JSON.stringify(rows.results ?? []), {
      headers: { "content-type": "application/json" },
    });
  } catch (err: any) {
    // Always return JSON so the UI never renders an HTML error blob
    return new Response(
      JSON.stringify({ error: "ADMIN_USERS_QUERY_FAILED", message: String(err?.message || err) }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
};
