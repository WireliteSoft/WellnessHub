// functions/api/admin/recipes/index.ts
import { requireUser, requireAdmin } from "../../../_utils/auth";

type AdminRecipeRow = {
  id: string;
  title: string;
  category: string;
  description?: string | null;
  image_url?: string | null;
  created_at: string;
  updated_at: string;
  is_public: number;
  published: number;
  calories?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  ingredient_count?: number | null;
};

export const onRequestGet: PagesFunction = async ({ env, request }) => {
  try {
    const user = await requireUser(env as any, request);
    requireAdmin(user);

    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 200);
    const search = (url.searchParams.get("search") || "").trim();

    // Build SQL with optional search on title/description
    const base = `
      SELECT
        r.id, r.title, r.category, r.description, r.image_url,
        r.is_public, r.published, r.created_at, r.updated_at,
        rn.calories, rn.protein_g, rn.carbs_g, rn.fat_g,
        (SELECT COUNT(*) FROM recipe_ingredients ri WHERE ri.recipe_id = r.id) AS ingredient_count
      FROM recipes r
      LEFT JOIN recipe_nutrition rn ON rn.recipe_id = r.id
    `;
    const where = search
      ? `WHERE (r.title LIKE ? OR r.description LIKE ?)`
      : ``;
    const order = `ORDER BY r.created_at DESC LIMIT ?`;

    const stmt = env.DB.prepare(
      [base, where, order].filter(Boolean).join(" ")
    );

    const bind = search ? [`%${search}%`, `%${search}%`, limit] : [limit];
    const res = await stmt.bind(...bind).all<AdminRecipeRow>();

    return json(res.results ?? []);
  } catch (err: any) {
    return errorJSON(err);
  }
};

export const onRequestPatch: PagesFunction = async ({ env, request }) => {
  try {
    const user = await requireUser(env as any, request);
    requireAdmin(user);

    const url = new URL(request.url);
    const id = url.pathname.split("/").pop(); // .../api/admin/recipes/:id
    if (!id) return new Response("Bad request", { status: 400 });

    let body: any;
    try { body = await request.json(); } catch { body = {}; }

    const fields: string[] = [];
    const values: any[] = [];

    if (typeof body.title === "string") {
      fields.push("title = ?");
      values.push(body.title.trim());
    }
    if (typeof body.category === "string") {
      fields.push("category = ?");
      values.push(body.category);
    }
    if (typeof body.description === "string") {
      fields.push("description = ?");
      values.push(body.description);
    }
    if (typeof body.image_url === "string") {
      fields.push("image_url = ?");
      values.push(body.image_url);
    }
    if (typeof body.is_public === "boolean") {
      fields.push("is_public = ?");
      values.push(body.is_public ? 1 : 0);
    }
    if (typeof body.published === "boolean") {
      fields.push("published = ?");
      values.push(body.published ? 1 : 0);
    }

    if (fields.length === 0) {
      return new Response("No changes", { status: 400 });
    }

    fields.push("updated_at = datetime('now')");

    const sql = `UPDATE recipes SET ${fields.join(", ")} WHERE id = ?`;
    values.push(id);

    await env.DB.prepare(sql).bind(...values).run();
    return json({ ok: true });
  } catch (err: any) {
    return errorJSON(err);
  }
};

export const onRequestDelete: PagesFunction = async ({ env, request }) => {
  try {
    const user = await requireUser(env as any, request);
    requireAdmin(user);

    const url = new URL(request.url);
    const id = url.pathname.split("/").pop(); // .../api/admin/recipes/:id
    if (!id) return new Response("Bad request", { status: 400 });

    // FK cascade will clean children (ingredients/steps/nutrition)
    await env.DB.prepare(`DELETE FROM recipes WHERE id = ?`).bind(id).run();

    return json({ ok: true });
  } catch (err: any) {
    return errorJSON(err);
  }
};

/* ----------------- helpers ----------------- */
function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function errorJSON(err: any, status = 500) {
  const message = typeof err?.message === "string" ? err.message : String(err);
  // Return a JSON error so you see details in the browser console instead of the 1101 HTML page
  return json({ error: message }, status);
}
