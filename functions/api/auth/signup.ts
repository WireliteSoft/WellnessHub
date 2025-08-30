// functions/api/auth/signup.ts
type SignUpIn = { name: string; email: string; password: string };

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}
const normEmail = (e: string) => e.trim().toLowerCase();

export const onRequestPost: PagesFunction = async ({ env, request }) => {
  let body: SignUpIn | null = null;
  try { body = await request.json(); } catch {}
  if (!body?.name || !body?.email || !body?.password) {
    return new Response("name, email, password required", { status: 400 });
  }

  const email = normEmail(body.email);
  const exists = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (exists) return new Response("email in use", { status: 409 });

  const salt = crypto.randomUUID();
  const hash = await sha256Hex(`${salt}:${body.password}`);
  const password_hash = `${salt}$${hash}`;

  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO users (id,email,name,password_hash,created_at,updated_at) VALUES (?,?,?,?,datetime('now'),datetime('now'))"
  ).bind(id, email, body.name.trim(), password_hash).run();

  const token = crypto.randomUUID();
  const exp = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  await env.DB.prepare(
    "INSERT INTO auth_sessions (id,user_id,issued_at,expires_at) VALUES (?,?,datetime('now'),?)"
  ).bind(token, id, exp).run();

  const user = await env.DB.prepare(
    "SELECT id,email,name,is_admin,is_nutritionist FROM users WHERE id=?"
  ).bind(id).first();

  return new Response(JSON.stringify({ token, user }), { headers: { "content-type": "application/json" } });
};
