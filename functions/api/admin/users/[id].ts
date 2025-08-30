import { requireUser, requireAdmin } from "../../../_utils/auth";

// PATCH /api/admin/users/:id  { is_admin?: boolean, is_nutritionist?: boolean }
export const onRequestPatch: PagesFunction = async ({ env, request, params }) => {
  const me = await requireUser(env as any, request);
  requireAdmin(me);

  const id = String(params?.id || "");
  if (!id) return new Response("missing id", { status: 400 });

  let body: any = null;
  try { body = await request.json(); } catch { /* ignore */ }

  const sets: string[] = [];
  const binds: any[] = [];

  if (typeof body?.is_admin === "boolean") {
    sets.push("is_admin = ?");
    binds.push(body.is_admin ? 1 : 0);
  }
  if (typeof body?.is_nutritionist === "boolean") {
    sets.push("is_nutritionist = ?");
    binds.push(body.is_nutritionist ? 1 : 0);
  }

  if (sets.length === 0) return new Response("no changes", { status: 400 });

  const sql = `UPDATE users SET ${sets.join(", ")}, updated_at = datetime('now') WHERE id = ?`;
  binds.push(id);

  const res = await env.DB.prepare(sql).bind(...binds).run();
  if (res.meta.changes === 0) return new Response("not found", { status: 404 });

  const row = await env.DB
    .prepare(
      `SELECT u.id, u.email, u.name, u.is_admin, u.is_nutritionist, u.created_at,
              COALESCE(b.balance_cents,0) AS balance_cents
       FROM users u
       LEFT JOIN user_balances b ON b.user_id = u.id
       WHERE u.id = ?`
    )
    .bind(id)
    .first();

  return new Response(JSON.stringify(row ?? {}), { headers: { "content-type": "application/json" } });
};
