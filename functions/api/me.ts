// functions/api/me.ts
import { requireUser } from "../_utils/auth";

export const onRequestGet: PagesFunction = async ({ env, request }) => {
  const user = await requireUser(env as any, request);
  return new Response(JSON.stringify(user), { headers: { "content-type": "application/json" } });
};
