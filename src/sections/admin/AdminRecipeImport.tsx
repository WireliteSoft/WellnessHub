// src/sections/admin/AdminImportRecipes.tsx
import React, { useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Globe, Upload, ListChecks, Trash2 } from "lucide-react";

type ImportDetail = { url: string; ok: boolean; count?: number; error?: string };
type ImportResponse = {
  ok: boolean;
  succeeded: number;
  failed: number;
  inserted: number;
  updated: number;
  details: ImportDetail[];
};

const AdminImportRecipes: React.FC = () => {
  const { token } = useAuth();
  const headers = useMemo(
    () => ({ Authorization: `Bearer ${token}`, "content-type": "application/json" }),
    [token]
  );

  const [urlsText, setUrlsText] = useState(
    "https://www.themealdb.com/api/json/v1/1/lookup.php?i=52772"
  );
  const [limit, setLimit] = useState<number | "">(10);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const urls = useMemo(
    () =>
      urlsText
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean),
    [urlsText]
  );

  async function runImport() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      // Send single url when only one line; otherwise send urls[]
      const body =
        urls.length === 1
          ? { url: urls[0], ...(limit ? { limit } : {}) }
          : { urls, ...(limit ? { limit } : {}) };

      const res = await fetch("/api/admin/recipes/import", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      // Always try to parse JSON (our Worker returns JSON for errors, too)
      const txt = await res.text();
      let json: ImportResponse | { error: string };
      try {
        json = JSON.parse(txt);
      } catch {
        throw new Error(`Unexpected response: ${txt.slice(0, 200)}`);
      }

      if (!res.ok) throw new Error((json as any).error || "Import failed");

      setResult(json as ImportResponse);
    } catch (e: any) {
      setError(e?.message || "Server error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Import Recipes
        </h2>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* left: input form */}
        <div className="lg:col-span-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Recipe URLs (one per line)
          </label>
          <textarea
            value={urlsText}
            onChange={(e) => setUrlsText(e.target.value)}
            rows={8}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-3"
            placeholder="https://www.themealdb.com/api/json/v1/1/lookup.php?i=52772"
          />
          <div className="mt-3 flex items-center gap-3">
            <label className="text-sm text-gray-700 dark:text-gray-300">Per-URL limit (for searches)</label>
            <input
              type="number"
              min={1}
              max={50}
              value={limit}
              onChange={(e) => setLimit(e.target.value ? Number(e.target.value) : "")}
              className="w-24 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-2"
            />
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={runImport}
              disabled={loading || urls.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-blue-500 text-white disabled:opacity-60"
            >
              <Upload className={`h-4 w-4 ${loading ? "animate-pulse" : ""}`} />
              {loading ? "Importing…" : "Import"}
            </button>
            <button
              onClick={() => {
                setResult(null);
                setError(null);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200"
            >
              <Trash2 className="h-4 w-4" />
              Clear Results
            </button>
          </div>

          {error && <div className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</div>}
        </div>

        {/* right: results */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-2">
            <ListChecks className="h-4 w-4" />
            Results
          </h3>

          {!result ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {urls.length} URL{urls.length === 1 ? "" : "s"} ready. Click <b>Import</b> to begin.
            </p>
          ) : (
            <>
              <div className="text-sm text-gray-700 dark:text-gray-300">
                <b>{result.succeeded}</b> succeeded · <b>{result.failed}</b> failed
                <br />
                Inserted: <b>{result.inserted}</b> · Updated: <b>{result.updated}</b>
              </div>

              <div className="mt-3 max-h-64 overflow-auto rounded-lg border border-gray-200 dark:border-gray-800">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300">
                    <tr>
                      <th className="text-left px-2 py-1">URL</th>
                      <th className="text-left px-2 py-1">Status</th>
                      <th className="text-left px-2 py-1">Count / Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {result.details.map((d, i) => (
                      <tr key={i} className="text-gray-900 dark:text-gray-100">
                        <td className="px-2 py-1 break-all">{d.url}</td>
                        <td className="px-2 py-1">{d.ok ? "OK" : "Failed"}</td>
                        <td className="px-2 py-1">{d.ok ? d.count ?? 0 : d.error || "error"}</td>
                      </tr>
                    ))}
                    {result.details.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-2 py-3 text-center text-gray-500 dark:text-gray-400">
                          No details.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminImportRecipes;
