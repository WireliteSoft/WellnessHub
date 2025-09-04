import React, { useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Upload, RefreshCcw, Loader2 } from "lucide-react";

type ImportResult = {
  input: string;
  ok: boolean;
  inserted?: number;
  updated?: number;
  errors?: string[];
};

type ImportResponse = {
  ok: boolean;
  succeeded?: number;
  failed?: number;
  inserted?: number;
  updated?: number;
  results?: ImportResult[];
  error?: string;
};

const AdminRecipeImport: React.FC = () => {
  const { token } = useAuth();
  const [raw, setRaw] = useState("");
  const [category, setCategory] = useState<"" | "breakfast" | "lunch" | "dinner" | "snack" | "other">("");
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<ImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
    }),
    [token]
  );

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResp(null);
    setError(null);

    // Build body to match the server:
    // - one line → { url }
    // - multiple lines → { urls: [] }
    const lines = raw
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    const body: any =
      lines.length <= 1
        ? { url: lines[0] || "" }
        : { urls: lines };

    if (category) body.category = category;
    if (limit) body.limit = limit;

    try {
      const res = await fetch("/api/admin/recipes/import", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      // Your worker now always returns JSON on error, but be defensive:
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        const txt = await res.text();
        throw new Error(`Non-JSON response (${res.status}): ${txt.slice(0, 200)}`);
      }

      const data = (await res.json()) as ImportResponse;
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Import failed");
      }
      setResp(data);
    } catch (err: any) {
      setError(err?.message || "Server error");
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setRaw("");
    setResp(null);
    setError(null);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Import Recipes (TheMealDB)</h2>
        <button
          onClick={handleClear}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <RefreshCcw className="h-4 w-4" />
          Clear
        </button>
      </header>

      <form onSubmit={handleImport} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Recipe URLs (one per line) or MealDB numeric IDs
          </label>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={6}
            placeholder={`Examples:
https://www.themealdb.com/api/json/v1/1/lookup.php?i=52772
https://www.themealdb.com/api/json/v1/1/search.php?s=chicken
https://www.themealdb.com/api/json/v1/1/filter.php?c=Seafood
52772
`}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 px-3 py-2"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category (optional override)</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 px-3 py-2"
            >
              <option value="">(auto from source)</option>
              <option value="breakfast">breakfast</option>
              <option value="lunch">lunch</option>
              <option value="dinner">dinner</option>
              <option value="snack">snack</option>
              <option value="other">other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Limit (search/filter)</label>
            <input
              type="number"
              min={1}
              max={50}
              value={limit}
              onChange={(e) => setLimit(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 px-3 py-2"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading || !raw.trim()}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-white bg-gradient-to-r from-emerald-500 to-blue-500 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Import
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {resp && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 text-sm text-gray-800 dark:text-gray-200">
            Results • {resp.succeeded ?? 0} succeeded · {resp.failed ?? 0} failed
            {typeof resp.inserted === "number" || typeof resp.updated === "number" ? (
              <> · {resp.inserted ?? 0} inserted · {resp.updated ?? 0} updated</>
            ) : null}
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {(resp.results ?? []).map((r, idx) => (
              <div key={idx} className="px-4 py-3 text-sm">
                <div className="font-medium text-gray-900 dark:text-gray-100 break-all">{r.input}</div>
                {r.ok ? (
                  <div className="text-emerald-700 dark:text-emerald-400">
                    ok • inserted {r.inserted ?? 0} • updated {r.updated ?? 0}
                  </div>
                ) : (
                  <div className="text-red-600 dark:text-red-400">
                    failed {r.errors?.length ? `• ${r.errors.join("; ")}` : ""}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRecipeImport;
