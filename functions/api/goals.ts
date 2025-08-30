// functions/api/goals.ts
// Handles: GET /api/goals, POST /api/goals

type Env = { DB: D1Database };

async function requireUser(env: Env, req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.is_admin
       FROM auth_sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND datetime(s.expires_at) > datetime('now')`
  ).bind(token).first<{ id: string; email: string; is_admin: number }>();
  return row || null;
}

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers || {}) },
  });
}

export async function onRequestGet(context: { env: Env; request: Request }) {
  const user = await requireUser(context.env, context.request);
  if (!user) return json({ error: "unauthorized" }, { status: 401 });

  const rs = await context.env.DB.prepare(
    `SELECT id, title, target_value, unit, current_value, due_date, status, created_at, updated_at
       FROM goals
      WHERE user_id = ?
      ORDER BY created_at DESC`
  ).bind(user.id).all();

  return json(rs.results ?? []);
}

export async function onRequestPost(context: { env: Env; request: Request }) {
  const user = await requireUser(context.env, context.request);
  if (!user) return json({ error: "unauthorized" }, { status: 401 });

  let body: any;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "invalid json" }, { status: 400 });
  }

  const title = String(body?.title || "").trim();
  const target = Number(body?.target_value);
  const unit = String(body?.unit || "").trim();
  const due = body?.due_date ? String(body.due_date) : null;

  if (!title || !unit || !isFinite(target) || target <= 0) {
    return json({ error: "title, unit and positive target_value required" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const nowSql = `datetime('now')`;

  await context.env.DB.prepare(
    `INSERT INTO goals (id, user_id, title, target_value, unit, current_value, due_date, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, 'active', ${nowSql}, ${nowSql})`
  ).bind(id, user.id, title, target, unit, due).run();

  return json({ id });
}
