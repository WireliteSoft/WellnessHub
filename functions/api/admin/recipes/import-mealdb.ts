// functions/api/admin/recipes/import-mealdb.ts
import { requireUser, requireAdmin } from "../../_utils/auth";

type Meal = {
  idMeal: string;
  strMeal: string;
  strCategory: string | null;
  strInstructions: string | null;
  strMealThumb: string | null;
  strSource: string | null;
  [k: string]: any;
};

export const onRequestPost: PagesFunction = async ({ env, request }) => {
  // auth (must be admin)
  const user = await requireUser(env as any, request);
  requireAdmin(user);

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() || "";           // e.g. ?q=chicken
  const category = url.searchParams.get("category")?.trim()||"";// e.g. ?category=Seafood
  const limit = Math.min(Number(url.searchParams.get("limit") || 20), 50);

  let api = "";
  if (q) api = `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(q)}`;
  else if (category) api = `https://www.themealdb.com/api/json/v1/1/filter.php?c=${encodeURIComponent(category)}`;
  else return new Response("Provide ?q=search or ?category=name", { status: 400 });

  const up = await fetch(api);
  if (!up.ok) return new Response(`Upstream ${up.status}`, { status: 502 });
  const data = await up.json();
  let meals: Meal[] = data.meals ?? [];

  // If you used filter.php (category), we must look up each meal for full details.
  if (category && meals.length) {
    const full: Meal[] = [];
    for (const m of meals.slice(0, limit)) {
      const r = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${m.idMeal}`);
      if (r.ok) {
        const j = await r.json();
        if (j?.meals?.[0]) full.push(j.meals[0]);
      }
    }
    meals = full;
  } else {
    meals = meals.slice(0, limit);
  }

  let inserted = 0, skipped = 0;

  for (const m of meals) {
    // skip if already imported
    const exists = await env.DB.prepare(
      "SELECT id FROM recipes WHERE external_source=? AND external_id=?"
    ).bind("themealdb", m.idMeal).first();
    if (exists) { skipped++; continue; }

    const rid = crypto.randomUUID();

    // base recipe
    await env.DB.prepare(
      "INSERT INTO recipes (id,title,category,description,image_url,created_by,is_public,published,external_source,external_id,source_url,created_at,updated_at) VALUES (?,?,?,?,?,?,1,1,?,?,?,datetime('now'),datetime('now'))"
    ).bind(
      rid,
      m.strMeal,
      (m.strCategory || "other").toLowerCase(),
      null,                       // description (TheMealDB doesn't provide a summary)
      m.strMealThumb || null,
      user.id,
      "themealdb",
      m.idMeal,
      m.strSource || null
    ).run();

    // ingredients (1..20)
    const stmts: D1PreparedStatement[] = [];
    for (let i = 1; i <= 20; i++) {
      const name = (m[`strIngredient${i}`] || "").trim();
      const qty  = (m[`strMeasure${i}`]   || "").trim();
      if (!name) continue;
      stmts.push(
        env.DB.prepare(
          "INSERT INTO recipe_ingredients (id,recipe_id,name,quantity,position) VALUES (?,?,?,?,?)"
        ).bind(crypto.randomUUID(), rid, name, qty || null, i)
      );
    }

    // steps (split on blank lines / newlines)
    const steps = (m.strInstructions || "")
      .split(/\r?\n+/)
      .map(s => s.trim())
      .filter(Boolean);
    steps.forEach((text, idx) => {
      stmts.push(
        env.DB.prepare(
          "INSERT INTO recipe_steps (id,recipe_id,step_no,text) VALUES (?,?,?,?)"
        ).bind(crypto.randomUUID(), rid, idx + 1, text)
      );
    });

    // OPTIONAL: nutrition via Edamam if keys set in Pages → Settings → Environment variables
    if (env.EDAMAM_APP_ID && env.EDAMAM_APP_KEY) {
      try {
        const ingr: string[] = [];
        for (let i = 1; i <= 20; i++) {
          const ing = (m[`strIngredient${i}`] || "").trim();
          const meas = (m[`strMeasure${i}`] || "").trim();
          if (ing) ingr.push(`${meas} ${ing}`.trim());
        }
        const na = await fetch(
          `https://api.edamam.com/api/nutrition-details?app_id=${env.EDAMAM_APP_ID}&app_key=${env.EDAMAM_APP_KEY}`,
          { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: m.strMeal, ingr }) }
        );
        if (na.ok) {
          const nd = await na.json();
          const cal    = Math.round(nd.calories || 0);
          const prot   = Math.round(nd.totalNutrients?.PROCNT?.quantity || 0);
          const fat    = Math.round(nd.totalNutrients?.FAT?.quantity    || 0);
          const carbs  = Math.round(nd.totalNutrients?.CHOCDF?.quantity || 0);
          const fiber  = Math.round(nd.totalNutrients?.FIBTG?.quantity  || 0);
          const sugar  = Math.round(nd.totalNutrients?.SUGAR?.quantity  || 0);
          const sodium = Math.round(nd.totalNutrients?.NA?.quantity     || 0);

          stmts.push(
            env.DB.prepare(
              "INSERT INTO recipe_nutrition (recipe_id,calories,protein_g,carbs_g,fat_g,fiber_g,sugar_g,sodium_mg) VALUES (?,?,?,?,?,?,?,?)"
            ).bind(rid, cal, prot, carbs, fat, fiber, sugar, sodium)
          );
        }
      } catch { /* ignore nutrition errors */ }
    }

    if (stmts.length) await env.DB.batch(stmts);
    inserted++;
  }

  return new Response(JSON.stringify({ inserted, skipped }), {
    headers: { "content-type": "application/json" },
  });
};
