// functions/api/recipes/[id].ts
export const onRequestGet: PagesFunction = async ({ env, params }) => {
  const id = String(params?.id || "");
  if (!id) return new Response("bad request", { status: 400 });

  const rec = await env.DB.prepare(
    `SELECT r.id, r.title, r.category, r.description, r.image_url,
            COALESCE(n.calories,0)   AS calories,
            COALESCE(n.protein_g,0)  AS protein_g,
            COALESCE(n.carbs_g,0)    AS carbs_g,
            COALESCE(n.fat_g,0)      AS fat_g,
            COALESCE(n.fiber_g,0)    AS fiber_g,
            COALESCE(n.sugar_g,0)    AS sugar_g,
            COALESCE(n.sodium_mg,0)  AS sodium_mg
       FROM recipes r
       LEFT JOIN recipe_nutrition n ON n.recipe_id = r.id
      WHERE r.id = ?`
  ).bind(id).first();

  if (!rec) return new Response("not found", { status: 404 });

  const ingredients = await env.DB.prepare(
    `SELECT id, name, quantity, position
       FROM recipe_ingredients
      WHERE recipe_id = ?
      ORDER BY position ASC`
  ).bind(id).all();

  const steps = await env.DB.prepare(
    `SELECT id, step_no, text
       FROM recipe_steps
      WHERE recipe_id = ?
      ORDER BY step_no ASC`
  ).bind(id).all();

  const out = {
    id: rec.id,
    title: rec.title,
    category: rec.category,
    description: rec.description,
    image: rec.image_url,
    nutrition: {
      calories: rec.calories,
      protein: rec.protein_g,
      carbs: rec.carbs_g,
      fat: rec.fat_g,
      fiber: rec.fiber_g,
      sugar: rec.sugar_g,
      sodium: rec.sodium_mg,
    },
    ingredients: (ingredients.results ?? []).map((r: any) => ({
      id: r.id, name: r.name, quantity: r.quantity ?? null, position: r.position ?? 0
    })),
    instructions: (steps.results ?? []).map((r: any) => r.text),
  };

  return new Response(JSON.stringify(out), {
    headers: { "content-type": "application/json" },
  });
};
