import React, { useEffect, useMemo, useState } from "react";
import { X, UtensilsCrossed } from "lucide-react";
import { useRecipes } from "../contexts/RecipesContext";
import type { MealCategory } from "../types";

type RecipeDetail = {
  id: string;
  title: string;
  category: MealCategory | "other";
  description?: string;
  image?: string;
  nutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
    sugar?: number;
    sodium?: number;
  };
  ingredients: { id: string; name: string; quantity?: string; position?: number }[];
  instructions: string[];
};

const categories: (MealCategory | "all")[] = ["all", "breakfast", "lunch", "dinner", "snack", "other"];

const NutritionSection: React.FC = () => {
  const { recipes } = useRecipes(); // list view (includes macro summary + tiny ingredient preview)
  const [filter, setFilter] = useState<MealCategory | "all">("all");

  // modal state
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RecipeDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const list = useMemo(() => {
    const arr = recipes ?? [];
    return filter === "all" ? arr : arr.filter((r) => r.category === filter);
  }, [recipes, filter]);

  // fetch full recipe when modal opens
  useEffect(() => {
    let abort = false;
    async function run() {
      if (!openId) return;
      setLoading(true);
      setErr(null);
      setDetail(null);
      try {
        const res = await fetch(`/api/recipes/${openId}`);
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as RecipeDetail;
        if (!abort) setDetail(data);
      } catch (e: any) {
        if (!abort) setErr(e?.message || "Failed to load recipe");
      } finally {
        if (!abort) setLoading(false);
      }
    }
    run();
    return () => {
      abort = true;
    };
  }, [openId]);

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
            <div
              key={r.id}
              className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden"
            >
              {r.image ? (
                <img src={r.image} alt={r.title} className="h-40 w-full object-cover" />
              ) : (
                <div className="h-40 w-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                  <UtensilsCrossed className="h-6 w-6 text-gray-400" />
                </div>
              )}

              <div className="p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{r.title}</h3>
                  <span className="text-xs px-2 py-1 rounded-full border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 capitalize">
                    {r.category}
                  </span>
                </div>

                {r.description && (
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-3">{r.description}</p>
                )}

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

                {/* ingredients preview (from list) */}
                {r.ingredients?.length > 0 && (
                  <ul className="mt-4 text-sm text-gray-700 dark:text-gray-300 list-disc pl-5 space-y-1">
                    {r.ingredients.slice(0, 4).map((i) => (
                      <li key={i.id || i.name}>{i.quantity ? `${i.quantity} ` : ""}{i.name}</li>
                    ))}
                    {r._ingredientCount && r._ingredientCount > 4 && <li>…and more</li>}
                  </ul>
                )}

                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => setOpenId(r.id)}
                    className="px-3 py-1.5 rounded-lg text-sm bg-gradient-to-r from-emerald-500 to-blue-500 text-white hover:opacity-95"
                  >
                    View Recipe
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {openId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="relative max-w-2xl w-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl">
            <button
              onClick={() => setOpenId(null)}
              className="absolute top-3 right-3 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            {loading && (
              <div className="p-8 text-center text-gray-600 dark:text-gray-300">Loading…</div>
            )}

            {!loading && err && (
              <div className="p-8 text-center text-red-600 dark:text-red-400">{err}</div>
            )}

            {!loading && !err && detail && (
              <>
                {detail.image ? (
                  <img src={detail.image} alt={detail.title} className="w-full h-56 object-cover rounded-t-2xl" />
                ) : null}

                <div className="p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{detail.title}</h2>
                      <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">{detail.category}</div>
                    </div>
                  </div>

                  {detail.description && (
                    <p className="text-sm text-gray-700 dark:text-gray-300">{detail.description}</p>
                  )}

                  {/* macros (full detail has fiber/sugar/sodium too if you want to show) */}
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div className="rounded-md bg-gray-50 dark:bg-gray-800/60 px-2 py-1.5">
                      <div className="text-gray-500 dark:text-gray-400">Cal</div>
                      <div className="font-semibold text-gray-900 dark:text-gray-100">{detail.nutrition.calories}</div>
                    </div>
                    <div className="rounded-md bg-gray-50 dark:bg-gray-800/60 px-2 py-1.5">
                      <div className="text-gray-500 dark:text-gray-400">P</div>
                      <div className="font-semibold text-gray-900 dark:text-gray-100">{detail.nutrition.protein}g</div>
                    </div>
                    <div className="rounded-md bg-gray-50 dark:bg-gray-800/60 px-2 py-1.5">
                      <div className="text-gray-500 dark:text-gray-400">C</div>
                      <div className="font-semibold text-gray-900 dark:text-gray-100">{detail.nutrition.carbs}g</div>
                    </div>
                    <div className="rounded-md bg-gray-50 dark:bg-gray-800/60 px-2 py-1.5">
                      <div className="text-gray-500 dark:text-gray-400">F</div>
                      <div className="font-semibold text-gray-900 dark:text-gray-100">{detail.nutrition.fat}g</div>
                    </div>
                  </div>

                  {/* ingredients (full) */}
                  {detail.ingredients?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Ingredients</h3>
                      <ul className="text-sm text-gray-700 dark:text-gray-300 list-disc pl-5 space-y-1">
                        {detail.ingredients.map((i) => (
                          <li key={i.id}>
                            {i.quantity ? <span className="font-medium">{i.quantity}</span> : null}
                            {i.quantity ? " " : ""}
                            {i.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* steps (full) */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Instructions</h3>
                    {detail.instructions?.length ? (
                      <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-700 dark:text-gray-300">
                        {detail.instructions.map((t, idx) => (
                          <li key={idx}>{t}</li>
                        ))}
                      </ol>
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400">No steps yet.</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NutritionSection;
