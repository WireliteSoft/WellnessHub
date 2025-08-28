import React, { useMemo, useState } from "react";
import { useRecipes } from "../contexts/RecipesContext";
import type { MealCategory } from "../types";

const categories: (MealCategory | "all")[] = ["all", "breakfast", "lunch", "dinner", "snack", "other"];

const NutritionSection: React.FC = () => {
  const { recipes } = useRecipes();
  const [filter, setFilter] = useState<MealCategory | "all">("all");

  const list = useMemo(() => {
    const arr = recipes ?? [];
    return filter === "all" ? arr : arr.filter((r) => r.category === filter);
  }, [recipes, filter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Nutrition</h1>
        <div className="flex gap-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`px-3 py-1.5 rounded-lg text-sm ${
                filter === c
                  ? "bg-gradient-to-r from-emerald-500 to-blue-500 text-white"
                  : "border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <p className="text-gray-600 dark:text-gray-400">No recipes yet. Add some in Admin → Recipes.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {list.map((r) => (
            <div key={r.id} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
              {r.image && <img src={r.image} alt={r.title} className="h-40 w-full object-cover" />}
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{r.title}</h3>
                  <span className="text-xs px-2 py-1 rounded-full border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 capitalize">
                    {r.category}
                  </span>
                </div>
                {r.description && <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{r.description}</p>}

                {/* macros */}
                <div className="mt-4 grid grid-cols-4 gap-2 text-xs">
                  <div className="rounded-md bg-gray-50 dark:bg-gray-800/60 px-2 py-1.5">
                    <div className="text-gray-500 dark:text-gray-400">Cal</div>
                    <div className="font-semibold text-gray-900 dark:text-gray-100">{r.nutrition.calories}</div>
                  </div>
                  <div className="rounded-md bg-gray-50 dark:bg-gray-800/60 px-2 py-1.5">
                    <div className="text-gray-500 dark:text-gray-400">P</div>
                    <div className="font-semibold text-gray-900 dark:text-gray-100">{r.nutrition.protein}g</div>
                  </div>
                  <div className="rounded-md bg-gray-50 dark:bg-gray-800/60 px-2 py-1.5">
                    <div className="text-gray-500 dark:text-gray-400">C</div>
                    <div className="font-semibold text-gray-900 dark:text-gray-100">{r.nutrition.carbs}g</div>
                  </div>
                  <div className="rounded-md bg-gray-50 dark:bg-gray-800/60 px-2 py-1.5">
                    <div className="text-gray-500 dark:text-gray-400">F</div>
                    <div className="font-semibold text-gray-900 dark:text-gray-100">{r.nutrition.fat}g</div>
                  </div>
                </div>

                {/* ingredients preview */}
                {r.ingredients.length > 0 && (
                  <ul className="mt-4 text-sm text-gray-700 dark:text-gray-300 list-disc pl-5 space-y-1">
                    {r.ingredients.slice(0, 4).map((i) => (
                      <li key={i.id || i.name}>
                        {i.quantity ? `${i.quantity} ` : ""}{i.name}
                      </li>
                    ))}
                    {r.ingredients.length > 4 && <li>…and more</li>}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NutritionSection;
