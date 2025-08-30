import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Search, RefreshCcw, Trash2 } from "lucide-react";

type Row = {
  id: string;
  title: string;
  category: string;
  is_public: number;
  published: number;
  created_at: string;
  created_by_email: string | null;
  ingredient_count: number;
  step_count: number;
};

const AdminRecipesTable: React.FC = () => {
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
    setLoading(true);
    setErr(null);
    try {
      const url = `/api/admin/recipes?limit=200&search=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers });
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

  async function onDelete(id: string) {
    if (!confirm("Delete this recipe? This cannot be undone.")) return;
    setErr(null);
    try {
      const res = await fetch(`/api/admin/recipes/${id}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok && res.status !== 204) throw new Error(await res.text());
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
            placeholder="Search recipes by title/category"
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
              <th className="text-left px-3 py-2">Public</th>
              <th className="text-left px-3 py-2">Published</th>
              <th className="text-left px-3 py-2">Ingredients</th>
              <th className="text-left px-3 py-2">Steps</th>
              <th className="text-left px-3 py-2">Created</th>
              <th className="text-left px-3 py-2">Created By</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {rows.map((r) => (
              <tr key={r.id} className="text-gray-900 dark:text-gray-100">
                <td className="px-3 py-2">{r.title}</td>
                <td className="px-3 py-2 capitalize">{r.category}</td>
                <td className="px-3 py-2">{r.is_public ? "Yes" : "No"}</td>
                <td className="px-3 py-2">{r.published ? "Yes" : "No"}</td>
                <td className="px-3 py-2">{r.ingredient_count}</td>
                <td className="px-3 py-2">{r.step_count}</td>
                <td className="px-3 py-2">{new Date(r.created_at).toLocaleString()}</td>
                <td className="px-3 py-2">{r.created_by_email || "—"}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => onDelete(r.id)}
                    className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-red-300 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
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
                <td colSpan={9} className="px-3 py-6 text-center text-gray-600 dark:text-gray-400">
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

export default AdminRecipesTable;
