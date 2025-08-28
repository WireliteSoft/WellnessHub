 DELETE or POST apiauthlogout
export const onRequestDelete PagesFunction = async ({ env, request }) = {
  const auth = request.headers.get(authorization)  ;
  const m = auth.match(^Bearers+(.+)$i);
  if (!m) return new Response(Unauthorized, { status 401 });

  const token = m[1];
  await env.DB.prepare(DELETE FROM auth_sessions WHERE id = ).bind(token).run();
  return new Response(null, { status 204 });
};

 allow POST too if you prefer calling it that way
export const onRequestPost = onRequestDelete;
