export type UserRow = {
  id: string;
  email: string | null;
  name: string | null;
  is_admin: number;
  is_nutritionist: number;
};

export async function requireUser(env: any, req: Request): Promise<UserRow> {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) throw new Response("Unauthorized", { status: 401 });
  const token = m[1];

  const session = await env.DB
    .prepare("SELECT user_id, expires_at FROM auth_sessions WHERE id = ?")
    .bind(token)
    .first<any>();

  if (!session) throw new Response("Unauthorized", { status: 401 });
  if (session.expires_at && new Date(session.expires_at) < new Date()) {
    throw new Response("Session expired", { status: 401 });
  }

  const user = await env.DB
    .prepare("SELECT id, email, name, is_admin, is_nutritionist FROM users WHERE id = ?")
    .bind(session.user_id)
    .first<UserRow>();

  if (!user) throw new Response("Unauthorized", { status: 401 });
  return user;
}

export function requireAdmin(user: UserRow) {
  if (!user.is_admin) throw new Response("Forbidden", { status: 403 });
}
