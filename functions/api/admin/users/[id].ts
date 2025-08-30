// functions/api/admin/users/[id].ts
import { requireUser, requireAdmin } from "../../../_utils/auth";

export const onRequestPatch: PagesFunction = async ({ env, request, params }) => {
  const user = await requireUser(env as any, request);
  requireAdmin(user);

  const id = String(params?.id || "");
  if (!id) return new Response("bad request", { status: 400 });

  let body: any = null;
  try { body = await request.json(); } catch {}
  if (!body || (body.is_admin === undefined && body.is_nutritionist === undefined)) {
    return new Response("no changes", { status: 400 });
  }

  const sets: string[] = [];
  const binds: any[] = [];

  if (body.is_admin !== undefined) {
    sets.push("is_admin = ?");
    binds.push(body.is_admin ? 1 : 0);
  }
  if (body.is_nutritionist !== undefined) {
    sets.push("is_nutritionist = ?");
    binds.push(body.is_nutritionist ? 1 : 0);
  }

  sets.push("updated_at = datetime('now')");

  const sql = `UPDATE users SET ${sets.join(", ")} WHERE id = ?`;
  binds.push(id);

  const res = await env.DB.prepare(sql).bind(...binds).run();
  if ((res.changes ?? 0) === 0) return new Response("not found", { status: 404 });

  return new Response("ok");
};
