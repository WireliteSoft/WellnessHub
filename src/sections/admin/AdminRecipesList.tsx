// src/sections/admin/AdminRecipesList.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Search, RefreshCcw, Trash2 } from "lucide-react";

type AdminRecipeRow = {
  id: string;
  title: string;
  category: string;
  description?: string | null;
  image?: string | null;
  is_public: number;
  published: number;
  created_at: string;
  created_by_email: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  ingredient_count: number;
  step_count: number;
};

const AdminRecipesList: React.FC = () => {
  const { token } = useAuth();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AdminRecipeRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
    }),
    [token]
  );

  async function load(signal?: AbortSignal) {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/admin/recipes?limit=200&search=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers, signal });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as AdminRecipeRow[];
      setRows(data);
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        setError(e?.message || "Failed to load recipes");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => load(ctrl.signal), 250);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, token]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this recipe? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/admin/recipes/${id}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok && res.status !== 204) throw new Error(await res.text());
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e: any) {
      setError(e?.message || "Delete failed");
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
            placeholder="Search by title or category"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
          />
        </div>
        <button
          onClick={() => load()}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
          disabled={loading}
        >
          <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300">
            <tr>
              <th className="text-left px-3 py-2">Title</th>
              <th className="text-left px-3 py-2">Category</th>
              <th className="text-left px-3 py-2">Macros</th>
              <th className="text-left px-3 py-2">Counts</th>
              <th className="text-left px-3 py-2">Created</th>
              <th className="text-left px-3 py-2">By</th>
              <th className="text-left px-3 py-2">State</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {rows.map((r) => (
              <tr key={r.id} className="text-gray-900 dark:text-gray-100">
                <td className="px-3 py-2">
                  <div className="font-medium">{r.title}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[22rem]">
                    {r.description || "—"}
                  </div>
                </td>
                <td className="px-3 py-2 capitalize">{r.category}</td>
                <td className="px-3 py-2">
                  <div className="text-xs text-gray-700 dark:text-gray-300">
                    Cal {r.calories} · P {r.protein_g}g · C {r.carbs_g}g · F {r.fat_g}g
                  </div>
                </td>
                <td className="px-3 py-2 text-xs text-gray-700 dark:text-gray-300">
                  {r.ingredient_count} ingredients · {r.step_count} steps
                </td>
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                  {new Date(r.created_at).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                  {r.created_by_email || "—"}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2 text-xs">
                    <span
                      className={`px-2 py-0.5 rounded-full border ${
                        r.is_public
                          ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                          : "border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300"
                      }`}
                    >
                      public
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full border ${
                        r.published
                          ? "border-blue-500 text-blue-600 dark:text-blue-400"
                          : "border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300"
                      }`}
                    >
                      published
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-red-300 text-red-700 dark:border-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                    title="Delete recipe"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-gray-600 dark:text-gray-400">
                  No recipes found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminRecipesList;
