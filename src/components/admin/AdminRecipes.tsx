import React, { useState } from "react";
import { useRecipes } from "../../contexts/RecipesContext";
import type { Ingredient, MealCategory, NutritionFacts } from "../../types";
import { Plus, Trash2, Upload } from "lucide-react";

const categories: MealCategory[] = ["breakfast", "lunch", "dinner", "snack", "other"];

export const AdminRecipes: React.FC = () => {
  const { addRecipe } = useRecipes();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<MealCategory>("other");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageData, setImageData] = useState<string | undefined>(undefined);

  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { id: "ing-1", name: "", quantity: "" },
  ]);

  const [nutrition, setNutrition] = useState<NutritionFacts>({
    calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0,
  });

  const [instructions, setInstructions] = useState<string[]>([""]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  function updateIngredient(idx: number, key: "name" | "quantity", value: string) {
    setIngredients((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: value };
      return next;
    });
  }

  function addIngredientRow() {
    setIngredients((prev) => [...prev, { id: `ing-${Date.now()}`, name: "", quantity: "" }]);
  }
  function removeIngredient(idx: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateInstruction(idx: number, value: string) {
    setInstructions((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  }
  function addInstructionRow() {
    setInstructions((prev) => [...prev, ""]);
  }
  function removeInstruction(idx: number) {
    setInstructions((prev) => prev.filter((_, i) => i !== idx));
  }

  async function onImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // convert small images to data URL; for bigger assets prefer hosting & URL
    const reader = new FileReader();
    reader.onload = () => setImageData(String(reader.result));
    reader.readAsDataURL(file);
  }

  function validate(): string | null {
    if (!title.trim()) return "Title is required.";
    if (!ingredients.some((i) => i.name.trim())) return "At least one ingredient is required.";
    if (!instructions.some((s) => s.trim())) return "Add at least one instruction step.";
    return null;
    // nutrition is optional but recommended; zero is allowed
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const v = validate();
    if (v) { setError(v); return; }
    setSaving(true);
    try {
      const img = imageData || (imageUrl.trim() || undefined);
      const cleanIngredients = ingredients.filter((i) => i.name.trim());
      const cleanSteps = instructions.filter((s) => s.trim());
      const id = addRecipe({
        title: title.trim(),
        category,
        description: description.trim() || undefined,
        ingredients: cleanIngredients,
        nutrition,
        instructions: cleanSteps,
        image: img,
      });
      setCreatedId(id);
      // reset the form but keep a small success state
      setTitle(""); setCategory("other"); setDescription("");
      setImageUrl(""); setImageData(undefined);
      setIngredients([{ id: "ing-1", name: "", quantity: "" }]);
      setNutrition({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 });
      setInstructions([""]);
    } catch (err) {
      setError("Failed to save recipe.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Admin • Recipes</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">Create recipes to power the Nutrition section.</p>
      </header>

      <form onSubmit={onSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: main details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Basics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1 text-gray-700 dark:text-gray-300">Title</label>
                <input
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2
                             text-gray-900 dark:text-gray-100"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm mb-1 text-gray-700 dark:text-gray-300">Category</label>
                <select
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2
                             text-gray-900 dark:text-gray-100"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as MealCategory)}
                >
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm mb-1 text-gray-700 dark:text-gray-300">Description</label>
              <textarea
                rows={3}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2
                           text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Ingredients</h2>
            <div className="space-y-3">
              {ingredients.map((ing, idx) => (
                <div key={ing.id} className="grid grid-cols-12 gap-2">
                  <input
                    placeholder="Name (e.g., Oats)"
                    className="col-span-6 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2
                               text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400"
                    value={ing.name}
                    onChange={(e) => updateIngredient(idx, "name", e.target.value)}
                  />
                  <input
                    placeholder="Quantity (e.g., 1 cup)"
                    className="col-span-5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2
                               text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400"
                    value={ing.quantity ?? ""}
                    onChange={(e) => updateIngredient(idx, "quantity", e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => removeIngredient(idx)}
                    className="col-span-1 inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addIngredientRow}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <Plus className="h-4 w-4" /> Add ingredient
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Instructions</h2>
            <div className="space-y-3">
              {instructions.map((step, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2">
                  <textarea
                    rows={2}
                    placeholder={`Step ${idx + 1}`}
                    className="col-span-11 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2
                               text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400"
                    value={step}
                    onChange={(e) => updateInstruction(idx, e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => removeInstruction(idx)}
                    className="col-span-1 inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addInstructionRow}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <Plus className="h-4 w-4" /> Add step
              </button>
            </div>
          </div>
        </div>

        {/* Right column: nutrition + image + actions */}
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Nutrition (per serving)</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["calories","Calories"],
                ["protein","Protein (g)"],
                ["carbs","Carbs (g)"],
                ["fat","Fat (g)"],
                ["fiber","Fiber (g)"],
                ["sugar","Sugar (g)"],
                ["sodium","Sodium (mg)"],
              ].map(([key,label]) => (
                <div key={key}>
                  <label className="block text-xs mb-1 text-gray-600 dark:text-gray-400">{label}</label>
                  <input
                    type="number"
                    step="any"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2
                               text-gray-900 dark:text-gray-100"
                    value={(nutrition as any)[key] ?? 0}
                    onChange={(e) => setNutrition({ ...nutrition, [key]: Number(e.target.value) } as NutritionFacts)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Image</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm mb-1 text-gray-700 dark:text-gray-300">Image URL (optional)</label>
                <input
                  placeholder="https://…"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2
                             text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm mb-1 text-gray-700 dark:text-gray-300">Or upload a small image</label>
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                  <Upload className="h-4 w-4" />
                  <span>Choose file</span>
                  <input type="file" accept="image/*" onChange={onImageFile} className="hidden" />
                </label>
                {imageData && <p className="text-xs text-gray-500 mt-2">Will store as Data URL. Keep it small.</p>}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
            {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}
            {createdId && <p className="text-sm text-emerald-600 dark:text-emerald-400 mb-3">Saved ✓</p>}
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-gradient-to-r from-emerald-500 to-blue-500 text-white font-medium py-2.5 hover:opacity-95 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save recipe"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default AdminRecipes;
