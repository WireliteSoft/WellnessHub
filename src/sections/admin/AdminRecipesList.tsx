import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Search, RefreshCcw, Trash2 } from "lucide-react";

type AdminRecipeRow = {
  id: string;
  title: string;
  category: string;
  description?: string | null;
  published: number;
  is_public: number;
  created_at: string;
};

const AdminRecipesList: React.FC = () => {
  const { token } = useAuth();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<AdminRecipeRow[]>([]);
  const retryTimer = useRef<number | null>(null);

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

      if (res.status === 401) {
        throw new Error("Unauthorized (admin only). Please log in again.");
      }
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
                  {/* hide ID; show short description if present */}
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
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
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
    </div>
  );
};

export default AdminRecipesList;
