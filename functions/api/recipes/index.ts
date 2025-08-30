// functions/api/recipes/index.ts
// GET /api/recipes -> lightweight list for cards (includes macro summary + tiny ingredient preview)

export const onRequestGet: PagesFunction = async ({ env }) => {
  // Note: binding must be named DB in Pages settings.
  const sql = `
    SELECT
      r.id,
      r.title,
      r.category,
      r.description,
      r.image_url AS image,
      COALESCE(rn.calories, 0)  AS calories,
      COALESCE(rn.protein_g, 0) AS protein_g,
      COALESCE(rn.carbs_g, 0)   AS carbs_g,
      COALESCE(rn.fat_g, 0)     AS fat_g,
      -- tiny preview: first 4 ingredient NAMES concatenated with ||
      (
        SELECT GROUP_CONCAT(name, '||') FROM (
          SELECT name
          FROM recipe_ingredients ri2
          WHERE ri2.recipe_id = r.id
          ORDER BY position, id
          LIMIT 4
        )
      ) AS ing_preview,
      -- total count (optional)
      (SELECT COUNT(*) FROM recipe_ingredients ri3 WHERE ri3.recipe_id = r.id) AS ingredient_count
    FROM recipes r
    LEFT JOIN recipe_nutrition rn ON rn.recipe_id = r.id
    WHERE r.is_public = 1 AND r.published = 1
    ORDER BY r.created_at DESC
    LIMIT 200;
  `;

  const res = await env.DB.prepare(sql).all();
  const rows = (res.results ?? []).map((row: any) => {
    // Map to the shape your cards expect
    const previewNames: string[] = row.ing_preview ? String(row.ing_preview).split("||") : [];
    return {
      id: row.id,
      title: row.title,
      category: row.category,
      description: row.description ?? "",
      image: row.image ?? undefined,
      nutrition: {
        calories: row.calories ?? 0,
        protein: row.protein_g ?? 0,
        carbs: row.carbs_g ?? 0,
        fat: row.fat_g ?? 0,
      },
      // cards only need a peek; the modal fetches full details
      ingredients: previewNames.map((name, i) => ({
        id: `${row.id}-pv-${i}`,
        name,
        quantity: undefined,
      })),
      instructions: [], // list view doesn’t carry steps; modal uses /api/recipes/:id
      _ingredientCount: row.ingredient_count ?? 0, // optional, if you want to show “...and more”
    };
  });

  return new Response(JSON.stringify(rows), {
    headers: { "content-type": "application/json" },
  });
};
