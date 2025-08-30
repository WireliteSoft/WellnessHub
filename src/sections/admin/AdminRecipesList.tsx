import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Search, RefreshCcw, Eye, EyeOff, Trash2, ToggleLeft, ToggleRight } from "lucide-react";

type Row = {
  id: string;
  title: string;
  category: string;
  description?: string | null;
  image_url?: string | null;
  is_public: number;
  published: number;
  created_at: string;
  updated_at: string;
  calories?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  ingredient_count?: number | null;
};

const AdminRecipesList: React.FC = () => {
  const { token } = useAuth();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
    }),
    [token]
  );

  async function load() {
    if (!token) return; // wait for auth
    setLoading(true);
    setErr(null);
    try {
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

  // Auto-load when token becomes available
  useEffect(() => { if (token) load(); }, [token]);

  // Debounced search
  useEffect(() => {
    if (!token) return;
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, token]);

  async function patch(id: string, body: Partial<Pick<Row, "is_public" | "published" | "title" | "category" | "description" | "image_url">>) {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/recipes/${id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...body, updated_at: new Date().toISOString() } : r)));
    } catch (e: any) {
      setErr(e?.message || "Update failed");
      load();
    }
  }

  async function del(id: string) {
    if (!token) return;
    if (!confirm("Delete this recipe?")) return;
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
              <th className="text-left px-3 py-2">Title</th>
              <th className="text-left px-3 py-2">Category</th>
              <th className="text-left px-3 py-2">Macros</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {rows.map((r) => (
              <tr key={r.id} className="text-gray-900 dark:text-gray-100">
                <td className="px-3 py-2">
                  <div className="font-medium">{r.title}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{r.id}</div>
                </td>
                <td className="px-3 py-2 capitalize">{r.category}</td>
                <td className="px-3 py-2 text-xs">
                  {r.calories ?? 0} cal • P {r.protein_g ?? 0}g • C {r.carbs_g ?? 0}g • F {r.fat_g ?? 0}g
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => patch(r.id, { published: !(r.published === 1) })}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs border-gray-300 dark:border-gray-700"
                      title="Toggle published"
                    >
                      {r.published ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                      {r.published ? "Published" : "Unpublished"}
                    </button>
                    <button
                      onClick={() => patch(r.id, { is_public: !(r.is_public === 1) })}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs border-gray-300 dark:border-gray-700"
                      title="Toggle visibility"
                    >
                      {r.is_public ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      {r.is_public ? "Public" : "Private"}
                    </button>
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => del(r.id)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
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
                <td colSpan={5} className="px-3 py-6 text-center text-gray-600 dark:text-gray-400">
                  No recipes found.
                </td>
              </tr>
            )}
            {loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-600 dark:text-gray-400">
                  Loading…
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
