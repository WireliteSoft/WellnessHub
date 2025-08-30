// functions/_utils/auth.ts
type Env = { DB: D1Database };

function j(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function readToken(req: Request): string | null {
  const h = req.headers.get("Authorization") || req.headers.get("authorization");
  if (h && h.startsWith("Bearer ")) return h.slice(7).trim();

  const url = new URL(req.url);
  const q = url.searchParams.get("token");
  if (q) return q.trim();

  const cookie = req.headers.get("Cookie") || "";
  const m = cookie.match(/(?:^|;\s*)session=([^;]+)/i);
  if (m) return m[1];

  return null;
}

export async function requireUser(env: Env, req: Request) {
  const token = readToken(req);
  if (!token) throw j({ error: "unauthorized", detail: "missing token" }, 401);

  // adjust to your schema if different:
  const sql = `
    SELECT u.id, u.email, u.name, u.is_admin, u.is_nutritionist, u.created_at
    FROM auth_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = ? AND s.expires_at > datetime('now')
    LIMIT 1
  `;
  const { results } = await env.DB.prepare(sql).bind(token).all();
  if (!results || results.length === 0) {
    throw j({ error: "unauthorized", detail: "invalid or expired token" }, 401);
  }
  return results[0];
}

export function requireAdmin(user: any) {
  if (!user?.is_admin) throw j({ error: "forbidden", detail: "admin only" }, 403);
}
