import { requireUser, requireAdmin } from "../../../_utils/auth";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const onRequestGet: PagesFunction = async ({ env, request }) => {
  // 1) Auth with hard guards so failures return JSON (not HTML)
  let me: any;
  try {
    me = await requireUser(env as any, request);
  } catch (err: any) {
    // If your helper threw a Response, surface it; otherwise send 401 JSON
    if (err instanceof Response) return err;
    return json({ error: "unauthorized", detail: String(err?.message || err) }, 401);
  }
  try {
    requireAdmin(me);
  } catch (err: any) {
    if (err instanceof Response) return err;
    return json({ error: "forbidden", detail: String(err?.message || err) }, 403);
  }

  // 2) Query params
  const url = new URL(request.url);
  const search = (url.searchParams.get("search") || "").trim();
  const limitRaw = url.searchParams.get("limit");
  const limit = Math.max(1, Math.min(parseInt(limitRaw || "50", 10) || 50, 200));
  const like = `%${search}%`;

  // 3) Minimal query: users table only (no views/joins)
  try {
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
    return json(results ?? []);
  } catch (err: any) {
    // Always JSON on failure so your UI shows a clean message
    return json({ error: "query_failed", detail: String(err?.message || err) }, 500);
  }
};
