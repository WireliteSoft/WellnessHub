// functions/api/auth/logout.ts
// Supports POST or DELETE to invalidate the current session token.
export const onRequestDelete: PagesFunction = async ({ env, request }) => {
  const auth = request.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return new Response("Unauthorized", { status: 401 });

  const token = m[1];
  await env.DB.prepare("DELETE FROM auth_sessions WHERE id = ?").bind(token).run();
  return new Response(null, { status: 204 });
};

// Allow POST as an alias (same handler)
export const onRequestPost = onRequestDelete;
