// functions/api/me.ts
import { requireUser } from "../_utils/auth";

export const onRequestGet: PagesFunction = async ({ env, request }) => {
  try {
    const user = await requireUser(env as any, request);

    // Return only what the client needs
    const out = {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      is_admin: user.is_admin ? 1 : 0,
      is_nutritionist: user.is_nutritionist ? 1 : 0,
      created_at: user.created_at ?? null,
    };

    return new Response(JSON.stringify(out), {
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (err: any) {
    const msg = String(err?.message || "").toLowerCase();
    const isAuthError =
      msg.includes("unauthorized") ||
      msg.includes("invalid") ||
      msg.includes("token") ||
      msg.includes("auth");

    const status = isAuthError ? 401 : 500;
    const body = isAuthError ? { error: "Unauthorized" } : { error: "Server error" };

    return new Response(JSON.stringify(body), {
      status,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    });
  }
};
