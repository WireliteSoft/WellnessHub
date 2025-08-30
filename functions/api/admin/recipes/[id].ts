import { requireUser, requireAdmin } from "../../../_utils/auth";

export const onRequestDelete: PagesFunction = async ({ env, request, params }) => {
  const user = await requireUser(env as any, request);
  requireAdmin(user);

  const id = String(params?.id || "").trim();
  if (!id) return new Response("missing id", { status: 400 });

  // ensure cascades
  await env.DB.prepare("PRAGMA foreign_keys = ON").run();

  const del = await env.DB.prepare("DELETE FROM recipes WHERE id = ?").bind(id).run();

  // If nothing deleted, return 404 so the UI can react
  if ((del.meta?.changes ?? 0) === 0) {
    return new Response("not found", { status: 404 });
  }

  return new Response(null, { status: 204 });
};
