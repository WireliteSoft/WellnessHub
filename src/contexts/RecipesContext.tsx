import React, { createContext, useContext, useMemo } from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";
import type { Recipe, NutritionFacts, Ingredient, MealCategory } from "../types";
import { foodRecommendations as mockFoods } from "../data/mockData"; // existing mock

type RecipesContextType = {
  recipes: Recipe[];
  addRecipe: (r: Omit<Recipe, "id" | "createdAt" | "updatedAt">) => string;
  updateRecipe: (id: string, patch: Partial<Omit<Recipe, "id" | "createdAt">>) => void;
  removeRecipe: (id: string) => void;
};

const RecipesContext = createContext<RecipesContextType | null>(null);

// one-time transform of your old mock into Recipe shape
function bootstrapFromMock(): Recipe[] {
  try {
    return mockFoods.map((f) => {
      const nutrition: NutritionFacts = {
        calories: f.calories ?? 0,
        protein: f.protein ?? 0,
        carbs: f.carbs ?? 0,
        fat: f.fat ?? 0,
      };
      const ingredients: Ingredient[] =
        (f.ingredients?.map((name: string, idx: number) => ({
          id: `${Date.now()}-${idx}`,
          name,
        }))) ?? [];

      const category: MealCategory =
        (["breakfast", "lunch", "dinner", "snack"].includes((f.category ?? "").toLowerCase())
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

export const RecipesProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [recipes, setRecipes] = useLocalStorage<Recipe[]>("recipes:v1", bootstrapFromMock());

  const ctx = useMemo<RecipesContextType>(() => ({
    recipes,
    addRecipe: (r) => {
      const now = new Date().toISOString();
      const id = crypto.randomUUID?.() ?? String(Math.random());
      const next: Recipe = { ...r, id, createdAt: now, updatedAt: now };
      setRecipes([...recipes, next]);
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
  }), [recipes, setRecipes]);

  return <RecipesContext.Provider value={ctx}>{children}</RecipesContext.Provider>;
};

export function useRecipes() {
  const v = useContext(RecipesContext);
  if (!v) throw new Error("useRecipes must be used within RecipesProvider");
  return v;
}
