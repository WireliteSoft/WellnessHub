import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  Search,
  RefreshCcw,
  Trash2,
  Edit2,
  Save,
  X,
  Plus,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

type AdminRecipeRow = {
  id: string;
  title: string;
  category: string;
  description?: string | null;
  published: number;
  is_public: number;
  created_at: string;
};

type RecipeDetail = {
  id: string;
  title: string;
  category: "breakfast" | "lunch" | "dinner" | "snack" | "other";
  description?: string;
  image?: string | null;
  nutrition?: {
    calories?: number;
    protein?: number; // detail endpoint uses protein/carbs/fat (no _g suffix)
    carbs?: number;
    fat?: number;
    fiber?: number;
    sugar?: number;
    sodium?: number;
  };
  ingredients: { id?: string; name: string; quantity?: string; position?: number }[];
  instructions: string[];
  is_public?: number;
  published?: number;
};

// categories for select
const CATS: Array<RecipeDetail["category"]> = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "other",
];

const AdminRecipesList: React.FC = () => {
  const { token } = useAuth();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<AdminRecipeRow[]>([]);
  const retryTimer = useRef<number | null>(null);

  // ---- edit modal state (full recipe) ----
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RecipeDetail | null>(null);
  const [pub, setPub] = useState<boolean>(true);
  const [pubvis, setPubvis] = useState<boolean>(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // token helper
  const getToken = () => token || localStorage.getItem("auth:token") || "";

  // ---------- list load ----------
  const load = async () => {
    const t = getToken();
    if (!t) {
      if (retryTimer.current) window.clearTimeout(retryTimer.current);
      retryTimer.current = window.setTimeout(load, 400);
      return;
    }

    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/recipes?limit=200&search=${encodeURIComponent(q)}`, {
        headers: {
          Authorization: `Bearer ${t}`,
          "content-type": "application/json",
        },
      });
      if (res.status === 401) throw new Error("Unauthorized (admin only). Please log in again.");
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as AdminRecipeRow[];
      setRows(data);
    } catch (e: any) {
      setErr(e?.message || "Failed to load recipes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    return () => {
      if (retryTimer.current) window.clearTimeout(retryTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleRefresh = () => load();

  const handleDelete = async (id: string) => {
    const t = getToken();
    if (!t) return;
    if (!confirm("Delete this recipe? This cannot be undone.")) return;

    try {
      const res = await fetch(`/api/admin/recipes/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) throw new Error(await res.text());
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e: any) {
      alert(e?.message || "Delete failed");
    }
  };

  // ---------- edit open ----------
  const openEdit = async (row: AdminRecipeRow) => {
    setEditingId(row.id);
    setDetailErr(null);
    setDetailLoading(true);
    setForm(null);
    setPub(row.published === 1);
    setPubvis(row.is_public === 1);

    try {
      const res = await fetch(`/api/recipes/${row.id}`);
      if (!res.ok) throw new Error(await res.text());
      const d = (await res.json()) as RecipeDetail;

      // normalize/ensure arrays
      d.ingredients = Array.isArray(d.ingredients) ? d.ingredients.map((ing, i) => ({
        id: ing.id || `${d.id}-ing-${i}`,
        name: ing.name || "",
        quantity: ing.quantity || "",
        position: i,
      })) : [];

      d.instructions = Array.isArray(d.instructions) ? d.instructions : [];

      // default nutrition numbers
      d.nutrition = {
        calories: d.nutrition?.calories ?? 0,
        protein:  d.nutrition?.protein  ?? 0,
        carbs:    d.nutrition?.carbs    ?? 0,
        fat:      d.nutrition?.fat      ?? 0,
        fiber:    d.nutrition?.fiber    ?? 0,
        sugar:    d.nutrition?.sugar    ?? 0,
        sodium:   d.nutrition?.sodium   ?? 0,
      };

      // some detail endpoints don’t return flags; keep UI ones
      d.is_public = row.is_public;
      d.published = row.published;

      setForm(d);
    } catch (e: any) {
      setDetailErr(e?.message || "Failed to load recipe details");
    } finally {
      setDetailLoading(false);
    }
  };

  // ---------- edit helpers ----------
  const setField = <K extends keyof RecipeDetail>(key: K, val: RecipeDetail[K]) =>
    form && setForm({ ...form, [key]: val });

  const setNut = (k: keyof NonNullable<RecipeDetail["nutrition"]>, v: number) => {
    if (!form) return;
    setForm({ ...form, nutrition: { ...(form.nutrition || {}), [k]: v } });
  };

  const addIngredient = () => {
    if (!form) return;
    const next = [...(form.ingredients || [])];
    next.push({
      id: `${form.id}-ing-${Date.now()}`,
      name: "",
      quantity: "",
      position: next.length,
    });
    setForm({ ...form, ingredients: next });
  };

  const updateIngredient = (idx: number, patch: Partial<RecipeDetail["ingredients"][number]>) => {
    if (!form) return;
    const next = [...form.ingredients];
    next[idx] = { ...next[idx], ...patch };
    setForm({ ...form, ingredients: next });
  };

  const moveIngredient = (idx: number, dir: -1 | 1) => {
    if (!form) return;
    const next = [...form.ingredients];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    // re-number positions
    for (let i = 0; i < next.length; i++) next[i].position = i;
    setForm({ ...form, ingredients: next });
  };

  const removeIngredient = (idx: number) => {
    if (!form) return;
    const next = form.ingredients.filter((_, i) => i !== idx).map((x, i) => ({ ...x, position: i }));
    setForm({ ...form, ingredients: next });
  };

  const addStep = () => {
    if (!form) return;
    const next = [...(form.instructions || [])];
    next.push("");
    setForm({ ...form, instructions: next });
  };

  const updateStep = (idx: number, txt: string) => {
    if (!form) return;
    const next = [...form.instructions];
    next[idx] = txt;
    setForm({ ...form, instructions: next });
  };

  const moveStep = (idx: number, dir: -1 | 1) => {
    if (!form) return;
    const next = [...form.instructions];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setForm({ ...form, instructions: next });
  };

  const removeStep = (idx: number) => {
    if (!form) return;
    const next = form.instructions.filter((_, i) => i !== idx);
    setForm({ ...form, instructions: next });
  };

  // ---------- save ----------
  const saveEdit = async () => {
    if (!form || !editingId) return;
    const t = getToken();
    if (!t) return;

    setSaving(true);
    setErr(null);
    try {
      // convert detail nutrition (protein/carbs/fat) -> API shape (_g keys)
      const payload = {
        title: form.title?.trim(),
        category: form.category,
        description: form.description ?? "",
        image_url: form.image ?? null,
        published: pub,
        is_public: pubvis,
        nutrition: {
          calories: form.nutrition?.calories ?? 0,
          protein_g: form.nutrition?.protein ?? 0,
          carbs_g: form.nutrition?.carbs ?? 0,
          fat_g: form.nutrition?.fat ?? 0,
          fiber_g: form.nutrition?.fiber ?? 0,
          sugar_g: form.nutrition?.sugar ?? 0,
          sodium_mg: form.nutrition?.sodium ?? 0,
        },
        ingredients: (form.ingredients || []).map((x, i) => ({
          id: x.id,
          name: (x.name || "").trim(),
          quantity: x.quantity || null,
          position: i,
        })),
        instructions: (form.instructions || []).map((s) => (s || "").trim()).filter(Boolean),
      };

      // preferred
      let res = await fetch(`/api/admin/recipes/${editingId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${t}`, "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      // graceful fallback
      if (res.status === 404 || res.status === 405) {
        res = await fetch(`/api/admin/recipes/update`, {
          method: "POST",
          headers: { Authorization: `Bearer ${t}`, "content-type": "application/json" },
          body: JSON.stringify({ id: editingId, ...payload }),
        });
      }

      if (!res.ok) throw new Error(await res.text());

      // reflect updated basics in the table
      setRows((prev) =>
        prev.map((r) =>
          r.id === editingId
            ? {
                ...r,
                title: payload.title || r.title,
                category: payload.category || r.category,
                description: payload.description ?? r.description,
                published: pub ? 1 : 0,
                is_public: pubvis ? 1 : 0,
              }
            : r
        )
      );

      setEditingId(null);
      setForm(null);
    } catch (e: any) {
      setErr(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* top bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Search recipes…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
          />
        </div>
        <button
          onClick={handleRefresh}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
          disabled={loading}
        >
          <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {err && <div className="text-sm text-red-600 dark:text-red-400">{err}</div>}

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300">
            <tr>
              <th className="text-left px-3 py-2">Title</th>
              <th className="text-left px-3 py-2">Category</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {rows.map((r) => (
              <tr key={r.id} className="text-gray-900 dark:text-gray-100">
                <td className="px-3 py-2">
                  <div className="font-medium">{r.title}</div>
                  {r.description ? (
                    <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                      {r.description}
                    </div>
                  ) : null}
                </td>

                <td className="px-3 py-2 capitalize text-gray-700 dark:text-gray-300">
                  {r.category}
                </td>

                <td className="px-3 py-2 text-right">
                  <div className="inline-flex gap-2">
                    <button
                      onClick={() => openEdit(r)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                      title="Edit"
                    >
                      <Edit2 className="h-4 w-4" /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-gray-600 dark:text-gray-400">
                  No recipes found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Full Edit Modal */}
      {editingId && form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl">
            <div className="flex items-start justify-between p-5 border-b border-gray-200 dark:border-gray-800">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Edit Recipe</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">ID: {editingId}</p>
              </div>
              <button
                onClick={() => {
                  setEditingId(null);
                  setForm(null);
                }}
                className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 max-h-[90vh] overflow-y-auto space-y-6">
              {detailLoading && (
                <div className="text-sm text-gray-600 dark:text-gray-300">Loading details…</div>
              )}
              {detailErr && (
                <div className="text-sm text-red-600 dark:text-red-400">{detailErr}</div>
              )}

              {/* Basics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="text-sm">
                  <span className="block text-gray-700 dark:text-gray-300 mb-1">Title</span>
                  <input
                    value={form.title}
                    onChange={(e) => setField("title", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
                  />
                </label>
                <label className="text-sm">
                  <span className="block text-gray-700 dark:text-gray-300 mb-1">Category</span>
                  <select
                    value={form.category}
                    onChange={(e) => setField("category", e.target.value as RecipeDetail["category"])}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 capitalize"
                  >
                    {CATS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm md:col-span-2">
                  <span className="block text-gray-700 dark:text-gray-300 mb-1">Image URL</span>
                  <input
                    value={form.image || ""}
                    onChange={(e) => setField("image", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
                    placeholder="https://…"
                  />
                </label>
                <label className="text-sm md:col-span-2">
                  <span className="block text-gray-700 dark:text-gray-300 mb-1">Description</span>
                  <textarea
                    value={form.description || ""}
                    onChange={(e) => setField("description", e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
                  />
                </label>
              </div>

              {/* Nutrition */}
              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Nutrition</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <label className="text-sm">
                    <span className="block text-gray-700 dark:text-gray-300 mb-1">Calories</span>
                    <input
                      type="number"
                      value={form.nutrition?.calories ?? 0}
                      onChange={(e) => setNut("calories", Number(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="block text-gray-700 dark:text-gray-300 mb-1">Protein (g)</span>
                    <input
                      type="number"
                      value={form.nutrition?.protein ?? 0}
                      onChange={(e) => setNut("protein", Number(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="block text-gray-700 dark:text-gray-300 mb-1">Carbs (g)</span>
                    <input
                      type="number"
                      value={form.nutrition?.carbs ?? 0}
                      onChange={(e) => setNut("carbs", Number(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="block text-gray-700 dark:text-gray-300 mb-1">Fat (g)</span>
                    <input
                      type="number"
                      value={form.nutrition?.fat ?? 0}
                      onChange={(e) => setNut("fat", Number(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
                    />
                  </label>

                  <label className="text-sm">
                    <span className="block text-gray-700 dark:text-gray-300 mb-1">Fiber (g)</span>
                    <input
                      type="number"
                      value={form.nutrition?.fiber ?? 0}
                      onChange={(e) => setNut("fiber", Number(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="block text-gray-700 dark:text-gray-300 mb-1">Sugar (g)</span>
                    <input
                      type="number"
                      value={form.nutrition?.sugar ?? 0}
                      onChange={(e) => setNut("sugar", Number(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="block text-gray-700 dark:text-gray-300 mb-1">Sodium (mg)</span>
                    <input
                      type="number"
                      value={form.nutrition?.sodium ?? 0}
                      onChange={(e) => setNut("sodium", Number(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
                    />
                  </label>
                </div>
              </div>

              {/* Ingredients */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">Ingredients</h4>
                  <button
                    onClick={addIngredient}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm"
                  >
                    <Plus className="h-4 w-4" /> Add Ingredient
                  </button>
                </div>
                <div className="space-y-2">
                  {form.ingredients.map((ing, idx) => (
                    <div key={ing.id || idx} className="grid grid-cols-12 gap-2 items-center">
                      <input
                        placeholder="Quantity (e.g., 1 cup)"
                        value={ing.quantity || ""}
                        onChange={(e) => updateIngredient(idx, { quantity: e.target.value })}
                        className="col-span-4 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                      />
                      <input
                        placeholder="Ingredient name"
                        value={ing.name}
                        onChange={(e) => updateIngredient(idx, { name: e.target.value })}
                        className="col-span-6 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                      />
                      <div className="col-span-2 flex items-center justify-end gap-1">
                        <button
                          onClick={() => moveIngredient(idx, -1)}
                          className="p-2 rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                          title="Move up"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => moveIngredient(idx, 1)}
                          className="p-2 rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                          title="Move down"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => removeIngredient(idx)}
                          className="p-2 rounded-md border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                          title="Remove"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {form.ingredients.length === 0 && (
                    <div className="text-sm text-gray-500 dark:text-gray-400">No ingredients yet.</div>
                  )}
                </div>
              </div>

              {/* Steps */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">Instructions</h4>
                  <button
                    onClick={addStep}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm"
                  >
                    <Plus className="h-4 w-4" /> Add Step
                  </button>
                </div>
                <div className="space-y-2">
                  {form.instructions.map((step, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-10">
                        <textarea
                          value={step}
                          onChange={(e) => updateStep(idx, e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                          placeholder={`Step ${idx + 1}`}
                        />
                      </div>
                      <div className="col-span-2 flex items-center justify-end gap-1">
                        <button
                          onClick={() => moveStep(idx, -1)}
                          className="p-2 rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                          title="Move up"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => moveStep(idx, 1)}
                          className="p-2 rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                          title="Move down"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => removeStep(idx)}
                          className="p-2 rounded-md border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                          title="Remove"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {form.instructions.length === 0 && (
                    <div className="text-sm text-gray-500 dark:text-gray-400">No steps yet.</div>
                  )}
                </div>
              </div>

              {/* Flags */}
              <div className="flex gap-6 items-center">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" checked={pub} onChange={(e) => setPub(e.target.checked)} />
                  Published
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" checked={pubvis} onChange={(e) => setPubvis(e.target.checked)} />
                  Public
                </label>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-2">
              <button
                onClick={() => {
                  setEditingId(null);
                  setForm(null);
                }}
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-blue-500 text-white disabled:opacity-70"
              >
                <Save className="h-4 w-4" />
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRecipesList;
