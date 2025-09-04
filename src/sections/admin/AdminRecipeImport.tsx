// src/sections/admin/AdminRecipesList.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Search, RefreshCcw, Edit2, Trash2, Save, X } from "lucide-react";

type Row = {
  id: string;
  title: string;
  category: string;
  description?: string | null;
  image?: string | null;
  created_at?: string;
  updated_at?: string;
  is_public?: number;
  published?: number;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
};

const AdminRecipesList: React.FC = () => {
  const { token } = useAuth();

  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // edit modal state
  const [editing, setEditing] = useState<Row | null>(null);
  const [cal, setCal] = useState<number>(0);
  const [pro, setPro] = useState<number>(0);
  const [carb, setCarb] = useState<number>(0);
  const [fat, setFat] = useState<number>(0);
  const [pub, setPub] = useState<boolean>(true);
  const [pubvis, setPubvis] = useState<boolean>(true); // is_public

  const headers = useMemo(
    () => ({ Authorization: `Bearer ${token}`, "content-type": "application/json" }),
    [token]
  );

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      // this is your existing admin list endpoint (keep using it)
      const res = await fetch(`/api/admin/recipes?limit=200&search=${encodeURIComponent(q)}`, { headers });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as Row[];
      setRows(data);
    } catch (e: any) {
      setErr(e?.message || "Failed to load recipes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openEdit(r: Row) {
    setEditing(r);
    setCal(Number(r.calories || 0));
    setPro(Number(r.protein_g || 0));
    setCarb(Number(r.carbs_g || 0));
    setFat(Number(r.fat_g || 0));
    setPub(r.published ? r.published === 1 : true);
    setPubvis(r.is_public ? r.is_public === 1 : true);
  }

  async function saveEdit() {
    if (!editing) return;
    setErr(null);
    try {
      const res = await fetch(`/api/admin/recipes/${editing.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          published: pub,
          is_public: pubvis,
          nutrition: {
            calories: cal,
            protein_g: pro,
            carbs_g: carb,
            fat_g: fat,
          },
        }),
      });
      if (!res.ok) throw new Error(await res.text());

      // Optimistic update in list
      setRows((prev) =>
        prev.map((r) =>
          r.id === editing.id
            ? {
                ...r,
                calories: cal,
                protein_g: pro,
                carbs_g: carb,
                fat_g: fat,
                published: pub ? 1 : 0,
                is_public: pubvis ? 1 : 0,
              }
            : r
        )
      );

      setEditing(null);
    } catch (e: any) {
      setErr(e?.message || "Save failed");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this recipe? This cannot be undone.")) return;
    setErr(null);
    try {
      const res = await fetch(`/api/admin/recipes/${id}`, { method: "DELETE", headers });
      if (!res.ok) throw new Error(await res.text());
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e: any) {
      setErr(e?.message || "Delete failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search recipes..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
          />
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
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
              <th className="text-left px-3 py-2 w-[44%]">Title</th>
              <th className="text-left px-3 py-2">Category</th>
              <th className="text-left px-3 py-2">Macros (Cal / P / C / F)</th>
              <th className="text-left px-3 py-2">Flags</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {rows.map((r) => (
              <tr key={r.id} className="text-gray-900 dark:text-gray-100">
                <td className="px-3 py-2">
                  <div className="font-medium truncate max-w-[32rem]" title={r.title}>{r.title}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[32rem]" title={r.description || ""}>
                    {r.description || "—"}
                  </div>
                </td>
                <td className="px-3 py-2 capitalize">{r.category}</td>
                <td className="px-3 py-2">
                  {`${r.calories ?? 0} • ${r.protein_g ?? 0}g • ${r.carbs_g ?? 0}g • ${r.fat_g ?? 0}g`}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      r.published ? "border-emerald-500 text-emerald-600 dark:text-emerald-400" : "border-gray-300 dark:border-gray-700 text-gray-500"
                    }`}>{r.published ? "Published" : "Draft"}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      r.is_public ? "border-blue-500 text-blue-600 dark:text-blue-400" : "border-gray-300 dark:border-gray-700 text-gray-500"
                    }`}>{r.is_public ? "Public" : "Private"}</span>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => openEdit(r)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                      title="Edit"
                    >
                      <Edit2 className="h-4 w-4" /> Edit
                    </button>
                    <button
                      onClick={() => remove(r.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" /> Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-600 dark:text-gray-400">
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
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{editing.title}</p>
              </div>
              <button
                onClick={() => setEditing(null)}
                className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="block text-gray-600 dark:text-gray-300 mb-1">Calories</span>
                <input type="number" value={cal} onChange={(e) => setCal(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800" />
              </label>
              <label className="text-sm">
                <span className="block text-gray-600 dark:text-gray-300 mb-1">Protein (g)</span>
                <input type="number" value={pro} onChange={(e) => setPro(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800" />
              </label>
              <label className="text-sm">
                <span className="block text-gray-600 dark:text-gray-300 mb-1">Carbs (g)</span>
                <input type="number" value={carb} onChange={(e) => setCarb(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800" />
              </label>
              <label className="text-sm">
                <span className="block text-gray-600 dark:text-gray-300 mb-1">Fat (g)</span>
                <input type="number" value={fat} onChange={(e) => setFat(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800" />
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
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-blue-500 text-white"
              >
                <Save className="h-4 w-4" /> Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRecipesList;
