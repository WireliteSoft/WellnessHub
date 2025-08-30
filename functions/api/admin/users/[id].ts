import { requireUser, requireAdmin } from "../../../_utils/auth";

// PATCH /api/admin/users/:id  { is_admin?: boolean, is_nutritionist?: boolean }
export const onRequestPatch: PagesFunction = async ({ env, request, params }) => {
  const me = await requireUser(env as any, request);
  requireAdmin(me);

  const id = String(params?.id || "");
  if (!id) return new Response("bad request", { status: 400 });

  let body: Partial<{ is_admin: boolean; is_nutritionist: boolean }> = {};
  try { body = await request.json(); } catch {}

  const sets: string[] = [];
  const binds: any[] = [];
  if (typeof body.is_admin === "boolean") {
    sets.push("is_admin = ?");
    binds.push(body.is_admin ? 1 : 0);
  }
  if (typeof body.is_nutritionist === "boolean") {
    sets.push("is_nutritionist = ?");
    binds.push(body.is_nutritionist ? 1 : 0);
  }
  if (sets.length === 0) return new Response("no fields", { status: 400 });

  binds.push(id);

  try {
    await env.DB.prepare(
      `UPDATE users SET ${sets.join(", ")}, updated_at = datetime('now') WHERE id = ?`,
    ).bind(...binds).run();

    const { results } = await env.DB.prepare(
      `SELECT id, email, name, is_admin, is_nutritionist, created_at FROM users WHERE id = ?`,
    ).bind(id).all();

    return new Response(JSON.stringify(results?.[0] ?? null), {
      headers: { "content-type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: "update_failed", detail: String(err?.message || err) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};
