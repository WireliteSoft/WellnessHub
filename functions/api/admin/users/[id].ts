import { requireUser, requireAdmin } from "../../../_utils/auth";

type Env = { DB: D1Database };

function text(msg: string, status = 400) {
  return new Response(msg, { status });
}

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json; charset=utf-8", ...init.headers },
  });
}

export const onRequestPatch: PagesFunction<Env> = async ({ env, request, params }) => {
  const me = await requireUser(env as any, request);
  requireAdmin(me);

  const id = String(params?.id || "");
  if (!id) return text("missing id", 400);

  let body: any = null;
  try {
    body = await request.json();
  } catch { /* ignore */ }

  const allowedKeys = ["is_admin", "is_nutritionist"];
  const patch: Record<string, any> = {};
  for (const k of allowedKeys) {
    if (k in (body ?? {})) {
      const v = body[k];
      if (typeof v !== "boolean") return text(`invalid ${k}`, 400);
      patch[k] = v ? 1 : 0;
    }
  }
  if (Object.keys(patch).length === 0) return text("no changes", 400);

  // Prevent self-lockout (optional): don’t allow removing your own admin
  if (me.id === id && patch.is_admin === 0) {
    return text("refusing to remove your own admin role", 403);
  }

  const sets = Object.keys(patch).map((k) => `${k}=?`).join(", ");
  const binds = [...Object.values(patch), id];

  await env.DB
    .prepare(`UPDATE users SET ${sets}, updated_at=datetime('now') WHERE id=?`)
    .bind(...binds)
    .run();

  const rs = await env.DB
    .prepare(
      `SELECT id, email, name, is_admin, is_nutritionist, created_at
         FROM users WHERE id=?`
    )
    .bind(id)
    .all();

  return json((rs.results ?? [])[0] ?? {});
};
