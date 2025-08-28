// functions/api/workouts/index.ts
import { requireUser } from "../../_utils/auth";

export const onRequestGet: PagesFunction = async ({ env, request }) => {
  const me = await requireUser(env as any, request);
  const rows = await env.DB
    .prepare(
      "SELECT id,name,type,duration_min,intensity,notes,created_at,updated_at FROM workouts WHERE user_id=? ORDER BY created_at DESC LIMIT 500"
    )
    .bind(me.id)
    .all();
  return new Response(JSON.stringify(rows.results ?? []), {
    headers: { "content-type": "application/json" },
  });
};

export const onRequestPost: PagesFunction = async ({ env, request }) => {
  const me = await requireUser(env as any, request);
  let body: any = null;
  try { body = await request.json(); } catch {}
  if (!body?.name || !body?.type || !body?.intensity) return new Response("bad request", { status: 400 });

  const id = crypto.randomUUID();
  await env.DB
    .prepare(
      "INSERT INTO workouts (id,user_id,name,type,duration_min,intensity,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,datetime('now'),datetime('now'))"
    )
    .bind(id, me.id, String(body.name).trim(), body.type, Number(body.duration_min ?? 0), body.intensity, body.notes ?? null)
    .run();

  return new Response(JSON.stringify({ id }), {
    headers: { "content-type": "application/json" },
  });
};
