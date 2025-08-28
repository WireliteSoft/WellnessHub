// functions/api/auth/dev-login.ts
export const onRequestPost: PagesFunction = async ({ env, request }) => {
  type In = { email: string; name?: string; is_admin?: boolean; is_nutritionist?: boolean };
  let body: In | null = null;
  try { body = await request.json(); } catch {}
  if (!body || !body.email) return new Response("email required", { status: 400 });

  // find or create user
  let user = await env.DB
    .prepare("SELECT id, email, name, is_admin, is_nutritionist FROM users WHERE email = ?")
    .bind(body.email)
    .first();

  if (!user) {
    const id = crypto.randomUUID();
    await env.DB
      .prepare(
        "INSERT INTO users (id,email,name,is_admin,is_nutritionist,created_at,updated_at) VALUES (?,?,?,?,?,datetime('now'),datetime('now'))"
      )
      .bind(id, body.email, body.name ?? null, body.is_admin ? 1 : 0, body.is_nutritionist ? 1 : 0)
      .run();

    user = await env.DB
      .prepare("SELECT id, email, name, is_admin, is_nutritionist FROM users WHERE id = ?")
      .bind(id)
      .first();
  }

  // issue session token (30 days)
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  await env.DB
    .prepare("INSERT INTO auth_sessions (id, user_id, issued_at, expires_at) VALUES (?,?,datetime('now'),?)")
    .bind(token, user.id, expiresAt)
    .run();

  return new Response(JSON.stringify({ token, user }), {
    headers: { "content-type": "application/json" },
  });
};
