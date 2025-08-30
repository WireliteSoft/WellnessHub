// functions/api/recipes.ts
// GET /api/recipes   -> list public published + your own
// POST /api/recipes  -> admin-only create (with ingredients/nutrition/steps)

type Env = { DB: D1Database };

type UserRow = { id: string; email: string; is_admin: number };

async function requireUser(env: Env, req: Request): Promise<UserRow | null> {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.is_admin
       FROM auth_sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND datetime(s.expires_at) > datetime('now')`
  ).bind(token).first<UserRow>();
  return row || null;
}

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers || {}) },
  });
}

// Shape your frontend expects
type RecipeOut = {
  id: string;
  title: string;
  category: 'breakfast'|'lunch'|'dinner'|'snack'|'other';
  description?: string;
  image?: string;
  ingredients: { id: string; name: string; quantity?: string }[];
  nutrition: { calories: number; protein: number; carbs: number; fat: number; fiber: number; sugar: number; sodium: number };
  instructions: string[];
  createdAt: string;
  updatedAt: string;
};

async function hydrateRecipe(env: Env, r: any): Promise<RecipeOut> {
  const [ings, nut, steps] = await Promise.all([
    env.DB.prepare(
      `SELECT id, name, quantity FROM recipe_ingredients WHERE recipe_id=? ORDER BY position ASC, id ASC`
    ).bind(r.id).all<any>(),
    env.DB.prepare(
      `SELECT calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg FROM recipe_nutrition WHERE recipe_id=?`
    ).bind(r.id).first<any>(),
    env.DB.prepare(
      `SELECT text FROM recipe_steps WHERE recipe_id=? ORDER BY step_no ASC`
    ).bind(r.id).all<any>(),
  ]);

  return {
    id: r.id,
    title: r.title,
    category: r.category,
    description: r.description ?? undefined,
    image: r.image_url ?? undefined,
    ingredients: (ings.results || []).map((i: any) => ({ id: i.id, name: i.name, quantity: i.quantity ?? undefined })),
    nutrition: {
      calories: Number(nut?.calories ?? 0),
      protein: Number(nut?.protein_g ?? 0),
      carbs: Number(nut?.carbs_g ?? 0),
      fat: Number(nut?.fat_g ?? 0),
      fiber: Number(nut?.fiber_g ?? 0),
      sugar: Number(nut?.sugar_g ?? 0),
      sodium: Number(nut?.sodium_mg ?? 0),
    },
    instructions: (steps.results || []).map((s: any) => String(s.text)),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function onRequestGet({ env, request }: { env: Env; request: Request }) {
  const user = await requireUser(env, request);
  const args: any[] = [];
  let where = `WHERE is_public=1 AND published=1`;
  if (user) {
    where = `WHERE (is_public=1 AND published=1) OR created_by=?`;
    args.push(user.id);
  }

  const rs = await env.DB.prepare(
    `SELECT id, title, category, description, image_url, created_at, updated_at
       FROM recipes
       ${where}
       ORDER BY created_at DESC
       LIMIT 200`
  ).bind(...args).all<any>();

  const rows = rs.results || [];
  const out: RecipeOut[] = [];
  for (const r of rows) out.push(await hydrateRecipe(env, r));
  return json(out);
}

export async function onRequestPost({ env, request }: { env: Env; request: Request }) {
  const user = await requireUser(env, request);
  if (!user || !user.is_admin) return json({ error: "forbidden" }, { status: 403 });

  let body: any;
  try { body = await request.json(); } catch { return json({ error: "invalid json" }, { status: 400 }); }

  const title = String(body?.title || "").trim();
  const category = String(body?.category || "other") as RecipeOut['category'];
  if (!title) return json({ error: "title required" }, { status: 400 });

  const id = crypto.randomUUID();
  const nowSql = `datetime('now')`;

  await env.DB.prepare(
    `INSERT INTO recipes (id, title, category, description, image_url, created_by, is_public, published, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, 1, ${nowSql}, ${nowSql})`
  ).bind(id, title, category, body?.description ?? null, body?.image ?? null, user.id).run();

  // children
  const batch: D1PreparedStatement[] = [];

  const ings = Array.isArray(body?.ingredients) ? body.ingredients : [];
  ings.forEach((ing: any, idx: number) => {
    const iid = crypto.randomUUID();
    batch.push(env.DB.prepare(
      `INSERT INTO recipe_ingredients (id, recipe_id, name, quantity, position) VALUES (?, ?, ?, ?, ?)`
    ).bind(iid, id, String(ing?.name || '').trim(), ing?.quantity ? String(ing.quantity) : null, idx));
  });

  const n = body?.nutrition || {};
  batch.push(env.DB.prepare(
    `INSERT INTO recipe_nutrition (recipe_id, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    Number(n?.calories ?? 0),
    Number(n?.protein ?? 0),
    Number(n?.carbs ?? 0),
    Number(n?.fat ?? 0),
    Number(n?.fiber ?? 0),
    Number(n?.sugar ?? 0),
    Number(n?.sodium ?? 0),
  ));

  const steps = Array.isArray(body?.instructions) ? body.instructions : [];
  steps.forEach((txt: string, i: number) => {
    const sid = crypto.randomUUID();
    batch.push(env.DB.prepare(
      `INSERT INTO recipe_steps (id, recipe_id, step_no, text) VALUES (?, ?, ?, ?)`
    ).bind(sid, id, i + 1, String(txt || '').trim()));
  });

  if (batch.length) await env.DB.batch(batch);

  // Return full hydrated recipe
  const base = await env.DB.prepare(
    `SELECT id, title, category, description, image_url, created_at, updated_at FROM recipes WHERE id=?`
  ).bind(id).first<any>();
  const out = await hydrateRecipe(env, base);
  return json(out, { status: 201 });
}
