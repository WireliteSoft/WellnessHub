import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Search, Shield, Stethoscope, RefreshCcw } from "lucide-react";

type AdminUserRow = {
  id: string;
  email: string;
  name: string | null;
  is_admin: number;
  is_nutritionist: number;
  created_at: string;
  balance_cents: number;
  active_subscriptions: number;
};

const currency = (cents: number) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format((cents || 0) / 100);

const AdminUsers: React.FC = () => {
  const { token } = useAuth();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Build headers from the latest token each call
  const makeHeaders = useCallback(() => {
    const t = token || (typeof window !== "undefined" ? localStorage.getItem("auth:token") : null);
    return t
      ? {
          Authorization: `Bearer ${t}`,
          "content-type": "application/json",
        }
      : null;
  }, [token]);

  const load = useCallback(async () => {
    const headers = makeHeaders();
    if (!headers) return; // don't hit API without a token

    setLoading(true);
    setError(null);
    try {
      const url = `/api/admin/users?limit=50&search=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`${res.status} ${res.statusText}${txt ? `: ${txt}` : ""}`);
      }
      const data = (await res.json()) as AdminUserRow[];
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load users");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [makeHeaders, q]);

  // Only fetch when we actually have a token.
  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Optional: Press Enter in search box to load
  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter") load();
  };

  async function updateFlags(
    id: string,
    patch: Partial<{ is_admin: boolean; is_nutritionist: boolean }>
  ) {
    const headers = makeHeaders();
    if (!headers) return;
    setError(null);

    // optimistic
    const optimistic = rows.map((r) =>
      r.id === id
        ? {
            ...r,
            is_admin: patch.is_admin !== undefined ? (patch.is_admin ? 1 : 0) : r.is_admin,
            is_nutritionist:
              patch.is_nutritionist !== undefined ? (patch.is_nutritionist ? 1 : 0) : r.is_nutritionist,
          }
        : r
    );
    setRows(optimistic);

    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`${res.status} ${res.statusText}${txt ? `: ${txt}` : ""}`);
      }
    } catch (e: any) {
      setError(e?.message || "Update failed");
      load(); // revert to truth
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
            onKeyDown={onKeyDown}
            placeholder="Search by email or name"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
          />
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
          disabled={loading}
        >
          <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {(!token || loading) && rows.length === 0 && !error && (
        <div className="text-sm text-gray-600 dark:text-gray-400">Loading…</div>
      )}
      {error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300">
            <tr>
              <th className="text-left px-3 py-2">User</th>
              <th className="text-left px-3 py-2">Created</th>
              <th className="text-left px-3 py-2">Balance</th>
              <th className="text-left px-3 py-2">Active Subs</th>
              <th className="text-left px-3 py-2">Roles</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {rows.map((u) => (
              <tr key={u.id} className="text-gray-900 dark:text-gray-100">
                <td className="px-3 py-2">
                  <div className="font-medium">{u.email}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{u.name || "—"}</div>
                </td>
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                  {new Date(u.created_at).toLocaleString()}
                </td>
                <td className="px-3 py-2">{currency(u.balance_cents || 0)}</td>
                <td className="px-3 py-2">{u.active_subscriptions ?? 0}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => updateFlags(u.id, { is_admin: !(u.is_admin === 1) })}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs ${
                        u.is_admin
                          ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                          : "border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300"
                      }`}
                      title="Toggle admin"
                    >
                      <Shield className="h-3 w-3" />
                      Admin
                    </button>
                    <button
                      onClick={() => updateFlags(u.id, { is_nutritionist: !(u.is_nutritionist === 1) })}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs ${
                        u.is_nutritionist
                          ? "border-blue-500 text-blue-600 dark:text-blue-400"
                          : "border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300"
                      }`}
                      title="Toggle nutritionist"
                    >
                      <Stethoscope className="h-3 w-3" />
                      Nutritionist
                    </button>
                  </div>
                </td>
                <td className="px-3 py-2 text-right text-xs text-gray-500 dark:text-gray-400">{u.id}</td>
              </tr>
            ))}
            {rows.length === 0 && !loading && !error && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-600 dark:text-gray-400">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminUsers;
