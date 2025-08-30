import { requireUser, requireAdmin } from "../../../_utils/auth";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const onRequestPatch: PagesFunction = async ({ env, request, params }) => {
  let me: any;
  try {
    me = await requireUser(env as any, request);
  } catch (err: any) {
    if (err instanceof Response) return err;
    return json({ error: "unauthorized", detail: String(err?.message || err) }, 401);
  }
  try {
    requireAdmin(me);
  } catch (err: any) {
    if (err instanceof Response) return err;
    return json({ error: "forbidden", detail: String(err?.message || err) }, 403);
  }

  const id = String(params?.id || "");
  if (!id) return json({ error: "bad_request" }, 400);

  let body: Partial<{ is_admin: boolean; is_nutritionist: boolean }> = {};
  try { body = await request.json(); } catch {}

  const sets: string[] = [];
  const binds: any[] = [];
  if (typeof body.is_admin === "boolean") { sets.push("is_admin = ?"); binds.push(body.is_admin ? 1 : 0); }
  if (typeof body.is_nutritionist === "boolean") { sets.push("is_nutritionist = ?"); binds.push(body.is_nutritionist ? 1 : 0); }
  if (!sets.length) return json({ error: "no_fields" }, 400);
  binds.push(id);

  try {
    await env.DB.prepare(
      `UPDATE users SET ${sets.join(", ")}, updated_at = datetime('now') WHERE id = ?`,
    ).bind(...binds).run();

    const { results } = await env.DB.prepare(
      `SELECT id, email, name, is_admin, is_nutritionist, created_at FROM users WHERE id = ?`,
    ).bind(id).all();

    return json(results?.[0] ?? null);
  } catch (err: any) {
    return json({ error: "update_failed", detail: String(err?.message || err) }, 500);
  }
};
