import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Recipe, NutritionFacts, Ingredient, MealCategory } from "../types";

type RecipesContextType = {
  recipes: Recipe[];
  addRecipe: (r: Omit<Recipe, "id" | "createdAt" | "updatedAt">) => Promise<string>;
  updateRecipe: (id: string, patch: Partial<Omit<Recipe, "id" | "createdAt">>) => void; // local-only for now
  removeRecipe: (id: string) => void; // local-only for now
};

const RecipesContext = createContext<RecipesContextType | null>(null);

// map server rows to your Recipe type (server currently returns top-level fields only)
function mapServerRowToRecipe(row: any): Recipe {
  const now = new Date().toISOString();
  return {
    id: row.id,
    title: row.title ?? "Untitled",
    category: (row.category as MealCategory) ?? "other",
    description: row.description ?? "",
    image: row.image_url ?? undefined,
    // these are not returned by the minimal GET endpoint yet; default them
    ingredients: [] as Ingredient[],
    nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 } as NutritionFacts,
    instructions: [] as string[],
    createdAt: row.created_at ?? now,
    updatedAt: row.updated_at ?? now,
  };
}

function authHeaders() {
  const t = typeof window !== "undefined" ? localStorage.getItem("auth:token") : null;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export const RecipesProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  async function refreshRecipes() {
    try {
      const res = await fetch("/api/recipes", { headers: { "content-type": "application/json" } });
      if (!res.ok) throw new Error(`GET /api/recipes failed: ${res.status}`);
      const rows = await res.json();
      setRecipes(Array.isArray(rows) ? rows.map(mapServerRowToRecipe) : []);
    } catch (e) {
      console.error(e);
      setRecipes([]); // fail closed
    }
  }

  useEffect(() => {
    refreshRecipes();
  }, []);

  const ctx = useMemo<RecipesContextType>(() => ({
    recipes,

    // POSTS to server (admin-only). Returns new id and updates local cache.
    addRecipe: async (r) => {
      const body: any = {
        title: r.title,
        category: r.category,
        description: r.description ?? "",
        image: r.image ?? null,
        // server expects {name, quantity}
        ingredients: (r.ingredients ?? []).map((i) => ({ name: i.name, quantity: (i as any).quantity ?? "" })),
        instructions: r.instructions ?? [],
        // server expects *_g keys; map from your NutritionFacts
        nutrition: r.nutrition
          ? {
              calories: r.nutrition.calories ?? 0,
              protein_g: r.nutrition.protein ?? 0,
              carbs_g: r.nutrition.carbs ?? 0,
              fat_g: r.nutrition.fat ?? 0,
              fiber_g: r.nutrition.fiber ?? 0,
              sugar_g: r.nutrition.sugar ?? 0,
              sodium_mg: r.nutrition.sodium ?? 0,
            }
          : undefined,
      };

      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || `POST /api/recipes failed (${res.status})`);
      }
      const { id } = await res.json();

      // reflect in local state so UI updates immediately
      const now = new Date().toISOString();
      const newRecipe: Recipe = {
        ...r,
        id,
        createdAt: now,
        updatedAt: now,
        // ensure optional fields are shaped correctly
        ingredients: r.ingredients ?? [],
        nutrition:
          r.nutrition ?? { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 },
        instructions: r.instructions ?? [],
      };
      setRecipes((prev) => [newRecipe, ...prev]);

      return id;
    },

    // LOCAL ONLY (until you add PUT /api/recipes/:id). Keeps UI responsive.
    updateRecipe: (id, patch) => {
      setRecipes((prev) =>
        prev.map((rec) =>
          rec.id === id ? { ...rec, ...patch, updatedAt: new Date().toISOString() } : rec
        )
      );
      // TODO: add a server endpoint to persist edits
    },

    // LOCAL ONLY (until you add DELETE /api/recipes/:id)
    removeRecipe: (id) => {
      setRecipes((prev) => prev.filter((r) => r.id !== id));
      // TODO: add a server endpoint to persist deletes
    },
  }), [recipes]);

  return <RecipesContext.Provider value={ctx}>{children}</RecipesContext.Provider>;
};

export function useRecipes() {
  const v = useContext(RecipesContext);
  if (!v) throw new Error("useRecipes must be used within RecipesProvider");
  return v;
}
