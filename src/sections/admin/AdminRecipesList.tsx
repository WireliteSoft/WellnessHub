import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Search, RefreshCcw, Trash2, Edit2, Save, X } from "lucide-react";

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
  nutrition?: {
    calories?: number;
    protein?: number;  // note: public /api/recipes/:id uses camel names (protein, carbs, fat)
    carbs?: number;
    fat?: number;
  };
};

const AdminRecipesList: React.FC = () => {
  const { token } = useAuth();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<AdminRecipeRow[]>([]);
  const retryTimer = useRef<number | null>(null);

  // ---- edit modal state
  const [editing, setEditing] = useState<AdminRecipeRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [cal, setCal] = useState<number>(0);
  const [pro, setPro] = useState<number>(0);
  const [carb, setCarb] = useState<number>(0);
  const [fat, setFat] = useState<number>(0);
  const [pub, setPub] = useState<boolean>(true);
  const [pubvis, setPubvis] = useState<boolean>(true);
  const [detailErr, setDetailErr] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // read the freshest token (context OR localStorage fallback)
  const getToken = () => token || localStorage.getItem("auth:token") || "";

  const load = async () => {
    const t = getToken();

    // if token isn't ready yet, retry shortly
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
    // initial + whenever token changes from empty -> value
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

  // -------------- Edit flow --------------
  const openEdit = async (row: AdminRecipeRow) => {
    setEditing(row);
    setDetailErr(null);
    setDetailLoading(true);
    setPub(row.published === 1);
    setPubvis(row.is_public === 1);

    try {
      // pull full detail from the public endpoint to get current macros
      const res = await fetch(`/api/recipes/${row.id}`);
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as RecipeDetail;

      setCal(Number(data.nutrition?.calories || 0));
      setPro(Number(data.nutrition?.protein || 0));
      setCarb(Number(data.nutrition?.carbs || 0));
      setFat(Number(data.nutrition?.fat || 0));
    } catch (e: any) {
      setDetailErr(e?.message || "Failed to load recipe details");
      // defaults remain 0s so you can still correct them
      setCal(0); setPro(0); setCarb(0); setFat(0);
    } finally {
      setDetailLoading(false);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    const t = getToken();
    if (!t) return;

    setSaving(true);
    setErr(null);
    try {
      const payload = {
        published: pub,
        is_public: pubvis,
        nutrition: {
          calories: cal,
          protein_g: pro,
          carbs_g: carb,
          fat_g: fat,
        },
      };

      // Preferred: PATCH /api/admin/recipes/:id
      let res = await fetch(`/api/admin/recipes/${editing.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${t}`, "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      // Fallback if PATCH not implemented in your worker:
      if (res.status === 404 || res.status === 405) {
        res = await fetch(`/api/admin/recipes/update`, {
          method: "POST",
          headers: { Authorization: `Bearer ${t}`, "content-type": "application/json" },
          body: JSON.stringify({ id: editing.id, ...payload }),
        });
      }

      if (!res.ok) throw new Error(await res.text());

      // reflect flags in the table immediately
      setRows((prev) =>
        prev.map((r) =>
          r.id === editing.id
            ? { ...r, published: pub ? 1 : 0, is_public: pubvis ? 1 : 0 }
            : r
        )
      );

      setEditing(null);
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

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Edit Recipe</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{editing.title}</p>
              </div>
              <button
                onClick={() => setEditing(null)}
                className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {detailLoading ? (
              <div className="text-sm text-gray-600 dark:text-gray-300">Loading details…</div>
            ) : detailErr ? (
              <div className="text-sm text-red-600 dark:text-red-400">{detailErr}</div>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="block text-gray-600 dark:text-gray-300 mb-1">Calories</span>
                <input
                  type="number"
                  value={cal}
                  onChange={(e) => setCal(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
                />
              </label>
              <label className="text-sm">
                <span className="block text-gray-600 dark:text-gray-300 mb-1">Protein (g)</span>
                <input
                  type="number"
                  value={pro}
                  onChange={(e) => setPro(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
                />
              </label>
              <label className="text-sm">
                <span className="block text-gray-600 dark:text-gray-300 mb-1">Carbs (g)</span>
                <input
                  type="number"
                  value={carb}
                  onChange={(e) => setCarb(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
                />
              </label>
              <label className="text-sm">
                <span className="block text-gray-600 dark:text-gray-300 mb-1">Fat (g)</span>
                <input
                  type="number"
                  value={fat}
                  onChange={(e) => setFat(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
                />
              </label>
            </div>

            <div className="flex gap-4 items-center">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={pub} onChange={(e) => setPub(e.target.checked)} />
                Published
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={pubvis} onChange={(e) => setPubvis(e.target.checked)} />
                Public
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditing(null)}
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
