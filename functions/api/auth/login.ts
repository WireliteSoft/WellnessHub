// functions/api/auth/login.ts
type LoginIn = { email: string; password: string };

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}
const normEmail = (e: string) => e.trim().toLowerCase();

export const onRequestPost: PagesFunction = async ({ env, request }) => {
  let body: LoginIn | null = null;
  try { body = await request.json(); } catch {}
  if (!body?.email || !body?.password) return new Response("email, password required", { status: 400 });

  const email = normEmail(body.email);
  const row = await env.DB.prepare(
    "SELECT id,password_hash,name,email,is_admin,is_nutritionist FROM users WHERE email = ?"
  ).bind(email).first<{ id:string; password_hash:string; name:string|null; email:string; is_admin:number; is_nutritionist:number }>();

  if (!row?.password_hash) return new Response("invalid credentials", { status: 401 });
  const [salt, stored] = row.password_hash.split("$");
  const candidate = await sha256Hex(`${salt}:${body.password}`);
  if (candidate !== stored) return new Response("invalid credentials", { status: 401 });

  const token = crypto.randomUUID();
  const exp = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  await env.DB.prepare(
    "INSERT INTO auth_sessions (id,user_id,issued_at,expires_at) VALUES (?,?,datetime('now'),?)"
  ).bind(token, row.id, exp).run();

  const user = { id: row.id, name: row.name, email: row.email, is_admin: row.is_admin, is_nutritionist: row.is_nutritionist };
  return new Response(JSON.stringify({ token, user }), { headers: { "content-type": "application/json" } });
};
