import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";
import type { Recipe, NutritionFacts, Ingredient, MealCategory } from "../types";
import { foodRecommendations as mockFoods } from "../data/mockData";

type RecipesContextType = {
  recipes: Recipe[];
  reload: () => Promise<void>;
  addRecipe: (r: Omit<Recipe, "id" | "createdAt" | "updatedAt">) => Promise<string>;
  updateRecipe: (id: string, patch: Partial<Omit<Recipe, "id" | "createdAt">>) => void;
  removeRecipe: (id: string) => void;
};

const RecipesContext = createContext<RecipesContextType | null>(null);

function bootstrapFromMock(): Recipe[] {
  try {
    return mockFoods.map((f: any, i: number) => {
      const nutrition: NutritionFacts = {
        calories: f.calories ?? 0,
        protein: f.protein ?? 0,
        carbs: f.carbs ?? 0,
        fat: f.fat ?? 0,
        fiber: (f as any).fiber ?? 0,
        sugar: (f as any).sugar ?? 0,
        sodium: (f as any).sodium ?? 0,
      };
      const ingredients: Ingredient[] =
        (f.ingredients?.map((name: string, idx: number) => ({
          id: `${Date.now()}-${i}-${idx}`,
          name,
          quantity: undefined,
        }))) ?? [];
      const category: MealCategory =
        (["breakfast","lunch","dinner","snack","other"].includes((f.category ?? "").toLowerCase())
          ? (f.category.toLowerCase() as MealCategory)
          : "other");

      return {
        id: crypto.randomUUID?.() ?? String(Math.random()),
        title: f.name ?? "Untitled",
        category,
        description: f.description ?? "",
        ingredients,
        nutrition,
        instructions: f.instructions ?? [],
        image: f.imageUrl ?? undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });
  } catch {
    return [];
  }
}

function authHeaders() {
  const t = typeof window !== 'undefined' ? localStorage.getItem('auth:token') : null;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export const RecipesProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [recipes, setRecipes] = useLocalStorage<Recipe[]>("recipes:v1", bootstrapFromMock());
  const [loadedFromApi, setLoadedFromApi] = useState(false);

  const load = async () => {
    try {
      const res = await fetch("/api/recipes", { headers: { ...authHeaders() } });
      if (!res.ok) throw new Error(String(res.status));
      const server: any[] = await res.json();
      // server already returns nested structure in your Recipe shape
      const mapped: Recipe[] = server.map((r: any) => ({
        id: r.id,
        title: r.title,
        category: r.category,
        description: r.description ?? "",
        image: r.image ?? undefined,
        ingredients: r.ingredients || [],
        nutrition: r.nutrition || { calories:0, protein:0, carbs:0, fat:0, fiber:0, sugar:0, sodium:0 },
        instructions: r.instructions || [],
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));
      setRecipes(mapped);
      setLoadedFromApi(true);
    } catch (e) {
      // keep local mock if API not reachable
      setLoadedFromApi(false);
    }
  };

  useEffect(() => { load(); }, []);

  const ctx = useMemo<RecipesContextType>(() => ({
    recipes,
    reload: load,
    addRecipe: async (r) => {
      // try server first (admin only)
      try {
        const res = await fetch("/api/recipes", {
          method: "POST",
          headers: { "content-type": "application/json", ...authHeaders() },
          body: JSON.stringify(r),
        });
        if (res.ok) {
          const created = await res.json();
          const next: Recipe = {
            id: created.id,
            title: created.title,
            category: created.category,
            description: created.description ?? "",
            image: created.image ?? undefined,
            ingredients: created.ingredients || [],
            nutrition: created.nutrition || { calories:0, protein:0, carbs:0, fat:0, fiber:0, sugar:0, sodium:0 },
            instructions: created.instructions || [],
            createdAt: created.createdAt,
            updatedAt: created.updatedAt,
          };
          setRecipes([next, ...recipes]);
          return next.id;
        }
      } catch {/* fall through */}

      // fallback to local (non-admin or offline)
      const now = new Date().toISOString();
      const id = crypto.randomUUID?.() ?? String(Math.random());
      const next: Recipe = { ...r, id, createdAt: now, updatedAt: now };
      setRecipes([next, ...recipes]);
      return id;
    },
    updateRecipe: (id, patch) => {
      const next = recipes.map((rec) =>
        rec.id === id ? { ...rec, ...patch, updatedAt: new Date().toISOString() } : rec
      );
      setRecipes(next);
    },
    removeRecipe: (id) => {
      setRecipes(recipes.filter((r) => r.id !== id));
    },
  }), [recipes]);

  return <RecipesContext.Provider value={ctx}>{children}</RecipesContext.Provider>;
};

export function useRecipes() {
  const v = useContext(RecipesContext);
  if (!v) throw new Error("useRecipes must be used within RecipesProvider");
  return v;
}
