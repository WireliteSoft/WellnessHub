// functions/api/glucose/index.ts
import { requireUser } from "../../_utils/auth";

export const onRequestGet: PagesFunction = async ({ env, request }) => {
  const me = await requireUser(env as any, request);
  const rows = await env.DB
    .prepare(
      "SELECT id,mg_dl,reading_time,meal_context,notes FROM glucose_readings WHERE user_id=? ORDER BY reading_time DESC LIMIT 1000"
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
  if (typeof body?.mg_dl !== "number" || !body?.reading_time) return new Response("bad request", { status: 400 });

  const id = crypto.randomUUID();
  await env.DB
    .prepare(
      "INSERT INTO glucose_readings (id,user_id,mg_dl,reading_time,meal_context,notes,created_at) VALUES (?,?,?,?,?,?,datetime('now'))"
    )
    .bind(id, me.id, body.mg_dl, body.reading_time, body.meal_context ?? null, body.notes ?? null)
    .run();

  return new Response(JSON.stringify({ id }), {
    headers: { "content-type": "application/json" },
  });
};
