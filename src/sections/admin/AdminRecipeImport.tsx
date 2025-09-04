import React, { useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Download, Trash2, RefreshCcw } from "lucide-react";

type ImportOutcome = {
  url: string;
  status: number;
  ok: boolean;
  inserted?: number;
  updated?: number;
  succeeded?: number;
  failed?: number;
  error?: string;
  detail?: string;
};

const AdminRecipesImport: React.FC = () => {
  const { token } = useAuth();

  // UI state
  const [urlsText, setUrlsText] = useState<string>("");
  const [limit, setLimit] = useState<number>(10);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ImportOutcome[]>([]);

  // Build headers just like AdminUsers: include Authorization consistently
  const authHeaders = useMemo(() => {
    const tok = token || localStorage.getItem("auth:token") || "";
    const base: HeadersInit = { "content-type": "application/json" };
    return tok ? { ...base, Authorization: `Bearer ${tok}` } : base;
  }, [token]);

  const hasToken = useMemo(() => {
    const tok = token || localStorage.getItem("auth:token");
    return !!tok && tok.length > 0;
  }, [token]);

  async function doImport() {
    setError(null);
    setResults([]);

    // Ensure we have a token before attempting import
    if (!hasToken) {
      setError("Not signed in on this domain. Please log in and try again.");
      return;
    }

    const urls = urlsText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (urls.length === 0) {
      setError("Enter at least one ThemealDB API URL (lookup or search).");
      return;
    }

    setRunning(true);
    const newResults: ImportOutcome[] = [];

    try {
      for (const url of urls) {
        try {
          const res = await fetch("/api/admin/recipes/import", {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ url, limit }),
          });

          // Try to parse JSON; fall back to text
          const text = await res.text();
          let parsed: any = null;
          try { parsed = JSON.parse(text); } catch {}

          if (res.status === 401 || res.status === 403) {
            newResults.push({
              url,
              status: res.status,
              ok: false,
              error: parsed?.error || (res.status === 401 ? "Unauthorized" : "Forbidden"),
            });
          } else if (!res.ok) {
            newResults.push({
              url,
              status: res.status,
              ok: false,
              error: parsed?.error || "Server error",
              detail: parsed?.detail || text,
            });
          } else {
            newResults.push({
              url,
              status: res.status,
              ok: true,
              inserted: parsed?.inserted ?? 0,
              updated: parsed?.updated ?? 0,
              succeeded: parsed?.succeeded ?? 0,
              failed: parsed?.failed ?? 0,
            });
          }
        } catch (e: any) {
          newResults.push({
            url,
            status: 0,
            ok: false,
            error: "Network error",
            detail: String(e),
          });
        }
      }
    } finally {
      setResults(newResults);
      setRunning(false);
    }
  }

  function clearResults() {
    setResults([]);
    setError(null);
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Import Recipes (ThemealDB)</h2>
        <div className="flex gap-2">
          <button
            onClick={doImport}
            disabled={running || !hasToken}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-white
              ${running || !hasToken ? "bg-gray-400 cursor-not-allowed" : "bg-gradient-to-r from-emerald-500 to-blue-500 hover:opacity-95"}`}
            title={!hasToken ? "Log in first" : "Import"}
          >
            <Download className={`h-4 w-4 ${running ? "animate-bounce" : ""}`} />
            Import
          </button>
          <button
            onClick={clearResults}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <Trash2 className="h-4 w-4" />
            Clear Results
          </button>
        </div>
      </header>

      {!hasToken && (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
          You are not logged in on this deployment’s subdomain. Please sign in, then run the import.
        </div>
      )}

      <div className="grid gap-3">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Recipe URLs (one per line)</label>
        <textarea
          rows={6}
          value={urlsText}
          onChange={(e) => setUrlsText(e.target.value)}
          placeholder={
            "Examples:\n" +
            "https://www.themealdb.com/api/json/v1/1/lookup.php?i=52772\n" +
            "https://www.themealdb.com/api/json/v1/1/search.php?s=chicken"
          }
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-3"
        />
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Limit per search</label>
        <input
          type="number"
          min={1}
          max={50}
          value={limit}
          onChange={(e) => setLimit(Math.max(1, Math.min(50, parseInt(e.target.value || "0", 10) || 10)))}
          className="w-24 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-2"
        />
        <button
          onClick={() => setUrlsText("")}
          className="ml-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <RefreshCcw className="h-4 w-4" />
          Reset
        </button>
      </div>

      {error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}

      {results.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300">
              <tr>
                <th className="text-left px-3 py-2">URL</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Succeeded</th>
                <th className="text-left px-3 py-2">Inserted</th>
                <th className="text-left px-3 py-2">Updated</th>
                <th className="text-left px-3 py-2">Failed</th>
                <th className="text-left px-3 py-2">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {results.map((r, i) => (
                <tr key={i} className="text-gray-900 dark:text-gray-100">
                  <td className="px-3 py-2 max-w-[28rem] truncate">{r.url}</td>
                  <td className="px-3 py-2">{r.status}</td>
                  <td className="px-3 py-2">{r.succeeded ?? 0}</td>
                  <td className="px-3 py-2">{r.inserted ?? 0}</td>
                  <td className="px-3 py-2">{r.updated ?? 0}</td>
                  <td className="px-3 py-2">{r.failed ?? 0}</td>
                  <td className="px-3 py-2 text-red-600 dark:text-red-400">
                    {r.ok ? "-" : r.error || r.detail || "Error"}
                  </td>
                </tr>
              ))}
              {results.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-gray-600 dark:text-gray-400">
                    No results yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminRecipesImport;
