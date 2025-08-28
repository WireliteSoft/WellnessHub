// functions/api/recipes/index.ts
import { requireUser, requireAdmin } from "../../_utils/auth";

export const onRequestGet: PagesFunction = async ({ env }) => {
  const rows = await env.DB
    .prepare(
      "SELECT id, title, category, description, image_url FROM recipes WHERE is_public=1 AND published=1 ORDER BY created_at DESC LIMIT 200"
    )
    .all();
  return new Response(JSON.stringify(rows.results ?? []), {
    headers: { "content-type": "application/json" },
  });
};

export const onRequestPost: PagesFunction = async ({ env, request }) => {
  const user = await requireUser(env as any, request);
  requireAdmin(user);

  type In = {
    title: string;
    category: "breakfast" | "lunch" | "dinner" | "snack" | "other";
    description?: string;
    image?: string | null;
    ingredients: { name: string; quantity?: string }[];
    instructions: string[];
    nutrition?: {
      calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number; fiber_g?: number; sugar_g?: number; sodium_mg?: number;
    };
  };

  let body: In | null = null;
  try { body = await request.json(); } catch {}
  if (!body?.title || !body?.category) return new Response("bad request", { status: 400 });

  const rid = crypto.randomUUID();

  const stmts: any[] = [];
  stmts.push(
    env.DB
      .prepare(
        "INSERT INTO recipes (id,title,category,description,image_url,created_by,is_public,published,created_at,updated_at) VALUES (?,?,?,?,?,?,1,1,datetime('now'),datetime('now'))"
      )
      .bind(rid, body.title.trim(), body.category, body.description ?? null, body.image ?? null, user.id)
  );

  if (body.nutrition) {
    const n = body.nutrition;
    stmts.push(
      env.DB
        .prepare(
          "INSERT INTO recipe_nutrition (recipe_id,calories,protein_g,carbs_g,fat_g,fiber_g,sugar_g,sodium_mg) VALUES (?,?,?,?,?,?,?,?)"
        )
        .bind(
          rid,
          n.calories ?? 0,
          n.protein_g ?? 0,
          n.carbs_g ?? 0,
          n.fat_g ?? 0,
          n.fiber_g ?? 0,
          n.sugar_g ?? 0,
          n.sodium_mg ?? 0
        )
    );
  }

  (body.ingredients ?? []).forEach((ing, i) => {
    if (!ing.name?.trim()) return;
    stmts.push(
      env.DB
        .prepare("INSERT INTO recipe_ingredients (id,recipe_id,name,quantity,position) VALUES (?,?,?,?,?)")
        .bind(crypto.randomUUID(), rid, ing.name.trim(), ing.quantity ?? null, i)
    );
  });

  (body.instructions ?? []).forEach((txt, i) => {
    if (!txt?.trim()) return;
    stmts.push(
      env.DB
        .prepare("INSERT INTO recipe_steps (id,recipe_id,step_no,text) VALUES (?,?,?,?)")
        .bind(crypto.randomUUID(), rid, i + 1, txt.trim())
    );
  });

  await env.DB.batch(stmts);
  return new Response(JSON.stringify({ id: rid }), {
    headers: { "content-type": "application/json" },
  });
};
