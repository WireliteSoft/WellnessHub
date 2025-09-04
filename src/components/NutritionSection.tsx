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
  const { recipes } = useRecipes();
  const [filter, setFilter] = useState<MealCategory | "all">("all");

  // modal state (fixed the stray "the")
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
      {/* Responsive header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Nutrition</h1>

        <div className="flex flex-wrap gap-2 md:justify-end overflow-x-auto">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${
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

                {/* ingredients preview (safe read of _ingredientCount) */}
                {r.ingredients?.length > 0 && (
                  <ul className="mt-4 text-sm text-gray-700 dark:text-gray-300 list-disc pl-5 space-y-1">
                    {r.ingredients.slice(0, 4).map((i) => (
                      <li key={i.id || i.name}>{i.quantity ? `${i.quantity} ` : ""}{i.name}</li>
                    ))}
                    {!!(r as any)?._ingredientCount && (r as any)._ingredientCount > 4 && <li>…and more</li>}
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
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 overscroll-contain">
    {/* Card is capped to viewport and uses internal scroll */}
    <div className="relative w-full max-w-4xl sm:max-w-5xl rounded-2xl sm:rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl
                    max-h-[85vh] flex flex-col">
      {/* Close */}
      <button
        onClick={() => setOpenId(null)}
        className="absolute top-3 right-3 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Header image stays small and doesn't increase total height */}
      {detail?.image ? (
        <img
          src={detail.image}
          alt={detail.title}
          className="w-full max-h-56 sm:max-h-72 object-cover rounded-t-2xl shrink-0"
        />
      ) : null}

      {/* Scrollable content fills remaining space */}
      <div className="flex-1 min-h-0 overflow-y-auto p-6">
        {loading && (
          <div className="py-12 text-center text-gray-600 dark:text-gray-300">Loading…</div>
        )}

        {!loading && err && (
          <div className="py-12 text-center text-red-600 dark:text-red-400">{err}</div>
        )}

        {!loading && !err && detail && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 break-words">
                  {detail.title}
                </h2>
                <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">{detail.category}</div>
              </div>
            </div>

            {detail.description && (
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line break-words">
                {detail.description}
              </p>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="rounded-md bg-gray-50 dark:bg-gray-800/60 px-2 py-1.5">
                <div className="text-gray-500 dark:text-gray-400">Cal</div>
                <div className="font-semibold text-gray-900 dark:text-gray-100">
                  {detail.nutrition.calories}
                </div>
              </div>
              <div className="rounded-md bg-gray-50 dark:bg-gray-800/60 px-2 py-1.5">
                <div className="text-gray-500 dark:text-gray-400">P</div>
                <div className="font-semibold text-gray-900 dark:text-gray-100">
                  {detail.nutrition.protein}g
                </div>
              </div>
              <div className="rounded-md bg-gray-50 dark:bg-gray-800/60 px-2 py-1.5">
                <div className="text-gray-500 dark:text-gray-400">C</div>
                <div className="font-semibold text-gray-900 dark:text-gray-100">
                  {detail.nutrition.carbs}g
                </div>
              </div>
              <div className="rounded-md bg-gray-50 dark:bg-gray-800/60 px-2 py-1.5">
                <div className="text-gray-500 dark:text-gray-400">F</div>
                <div className="font-semibold text-gray-900 dark:text-gray-100">
                  {detail.nutrition.fat}g
                </div>
              </div>
            </div>

            {detail.ingredients?.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Ingredients</h3>
                <ul className="text-sm text-gray-700 dark:text-gray-300 list-disc pl-5 pr-2 space-y-1 break-words">
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

            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Instructions</h3>
              {detail.instructions?.length ? (
                <ol className="list-decimal pl-5 pr-2 space-y-2 text-sm text-gray-700 dark:text-gray-300 break-words">
                  {detail.instructions.map((t, idx) => (
                    <li key={idx} className="whitespace-pre-line">{t}</li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No steps yet.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
)}


    </div>
  );
};

export default NutritionSection;
