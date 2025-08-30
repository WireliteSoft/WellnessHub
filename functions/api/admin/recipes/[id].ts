// Delete a recipe (and cascading children via FKs)
import { requireUser, requireAdmin } from "../../../_utils/auth";

export const onRequestDelete: PagesFunction = async ({ env, request, params }) => {
  const user = await requireUser(env as any, request);
  requireAdmin(user);

  const id = String(params?.id || "").trim();
  if (!id) return new Response("missing id", { status: 400 });

  // Child tables have ON DELETE CASCADE; remove primary row
  await env.DB.prepare("DELETE FROM recipes WHERE id = ?").bind(id).run();

  return new Response(null, { status: 204 });
};
