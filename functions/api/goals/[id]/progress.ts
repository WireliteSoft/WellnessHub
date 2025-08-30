// functions/api/goals/[id]/progress.ts
// Handles: POST /api/goals/:id/progress

type Env = { DB: D1Database };

async function requireUser(env: Env, req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;
  const row = await env.DB.prepare(
    `SELECT u.id, u.email
       FROM auth_sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND datetime(s.expires_at) > datetime('now')`
  ).bind(token).first<{ id: string; email: string }>();
  return row || null;
}

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers || {}) },
  });
}

export async function onRequestPost(context: {
  env: Env;
  request: Request;
  params: { id: string };
}) {
  const user = await requireUser(context.env, context.request);
  if (!user) return json({ error: "unauthorized" }, { status: 401 });

  const goalId = context.params.id;
  if (!goalId) return json({ error: "missing goal id" }, { status: 400 });

  let body: any;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "invalid json" }, { status: 400 });
  }
  const delta = Number(body?.delta);
  const note = body?.note ? String(body.note) : null;
  if (!isFinite(delta) || delta <= 0) return json({ error: "delta must be > 0" }, { status: 400 });

  // Ensure the goal belongs to the user
  const owned = await context.env.DB.prepare(
    `SELECT id, target_value, current_value FROM goals WHERE id = ? AND user_id = ?`
  ).bind(goalId, user.id).first<{ id: string; target_value: number; current_value: number }>();
  if (!owned) return json({ error: "not found" }, { status: 404 });

  const progressId = crypto.randomUUID();

  // Atomic-ish update
  await context.env.DB.batch([
    context.env.DB.prepare(
      `INSERT INTO goal_progress (id, goal_id, delta, note, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`
    ).bind(progressId, goalId, delta, note),
    context.env.DB.prepare(
      `UPDATE goals
          SET current_value = current_value + ?,
              status = CASE WHEN (current_value + ?) >= target_value THEN 'completed' ELSE status END,
              updated_at = datetime('now')
        WHERE id = ? AND user_id = ?`
    ).bind(delta, delta, goalId, user.id),
  ]);

  return json({ ok: true, progress_id: progressId });
}
