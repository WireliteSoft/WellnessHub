// functions/api/admin/users/[id].ts
import { requireUser, requireAdmin } from "../../../_utils/auth";

export const onRequestPatch: PagesFunction = async ({ env, request, params }) => {
  const me = await requireUser(env as any, request);
  requireAdmin(me);

  const id = String(params?.id || "");
  if (!id) return new Response("missing id", { status: 400 });

  let body: any = null;
  try { body = await request.json(); } catch {}

  const fields: string[] = [];
  const binds: any[] = [];

  if (typeof body?.is_admin === "boolean") {
    fields.push("is_admin = ?");
    binds.push(body.is_admin ? 1 : 0);
  }
  if (typeof body?.is_nutritionist === "boolean") {
    fields.push("is_nutritionist = ?");
    binds.push(body.is_nutritionist ? 1 : 0);
  }
  if (fields.length === 0) return new Response("no changes", { status: 400 });

  const sql = `UPDATE users SET ${fields.join(", ")}, updated_at = datetime('now') WHERE id = ?`;
  binds.push(id);

  await env.DB.prepare(sql).bind(...binds).run();
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json" },
  });
};
