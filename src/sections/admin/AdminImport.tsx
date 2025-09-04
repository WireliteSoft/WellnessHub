// src/sections/admin/AdminImport.tsx
import React, { useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Link2, UploadCloud, Loader2, CheckCircle2, XCircle, RefreshCcw } from "lucide-react";

type ImportResult = {
  url: string;
  status: "pending" | "ok" | "error";
  id?: string;
  title?: string;
  error?: string;
};

const AdminImport: React.FC = () => {
  const { token } = useAuth();
  const [urlsText, setUrlsText] = useState("");
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
    }),
    [token]
  );

  function parseLines(text: string): string[] {
    return Array.from(
      new Set(
        text
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter((s) => s && /^https?:\/\//i.test(s))
      )
    );
  }

  async function importOne(url: string): Promise<ImportResult> {
    try {
      const res = await fetch("/api/admin/recipes/import", {
        method: "POST",
        headers,
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const t = await res.text();
        return { url, status: "error", error: t || `HTTP ${res.status}` };
      }

      const json = await res.json();
      const id = json?.id || json?.recipe_id || json?.data?.id;
      let title: string | undefined = json?.title;

      // Try to enrich with detail title if not present
      if (id && !title) {
        try {
          const d = await fetch(`/api/recipes/${id}`).then((r) => r.ok ? r.json() : null);
          title = d?.title || title;
        } catch {
          /* ignore detail enrichment errors */
        }
      }

      return { url, status: "ok", id, title };
    } catch (e: any) {
      return { url, status: "error", error: e?.message || "Network error" };
    }
  }

  async function handleImport() {
    const lines = parseLines(urlsText);
    if (lines.length === 0) {
      alert("Please paste at least one valid http(s) URL (one per line).");
      return;
    }
    setResults(lines.map((u) => ({ url: u, status: "pending" })));
    setImporting(true);

    const out: ImportResult[] = [];
    for (const url of lines) {
      // update UI per item
      setResults((prev) => prev.map((r) => (r.url === url ? { ...r, status: "pending" } : r)));

      const r = await importOne(url);
      out.push(r);
      setResults((prev) => prev.map((x) => (x.url === url ? r : x)));
    }

    setImporting(false);
  }

  function clearResults() {
    setResults([]);
  }

  const okCount = results.filter((r) => r.status === "ok").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Import Recipes from the Web</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Paste one or more recipe page URLs (one per line). We’ll fetch JSON-LD schema, extract ingredients,
          steps, and nutrition, and add them as published public recipes.
        </p>
      </header>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4">
        <label className="block text-sm mb-1 text-gray-700 dark:text-gray-300">Recipe URLs (one per line)</label>
        <textarea
          rows={6}
          value={urlsText}
          onChange={(e) => setUrlsText(e.target.value)}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400"
          placeholder={`https://www.example.com/recipe/one\nhttps://www.example.com/recipe/two`}
        />

        <div className="flex items-center gap-2">
          <button
            onClick={handleImport}
            disabled={importing || parseLines(urlsText).length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-gradient-to-r from-emerald-500 to-blue-500 text-white hover:opacity-95 disabled:opacity-60"
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            {importing ? "Importing…" : "Import"}
          </button>
          {results.length > 0 && (
            <button
              onClick={clearResults}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <RefreshCcw className="h-4 w-4" />
              Clear Results
            </button>
          )}
        </div>
      </div>

      {results.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-800/50 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 flex items-center justify-between">
            <div>
              Results • <span className="text-emerald-600">{okCount} succeeded</span> ·{" "}
              <span className="text-red-600">{errorCount} failed</span>
            </div>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {results.map((r) => (
              <div key={r.url} className="p-4 flex flex-col gap-1 text-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-gray-400" />
                    <a href={r.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline break-all">
                      {r.url}
                    </a>
                  </div>
                  <div className="ml-3">
                    {r.status === "pending" && (
                      <span className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-300">
                        <Loader2 className="h-4 w-4 animate-spin" /> Importing…
                      </span>
                    )}
                    {r.status === "ok" && (
                      <span className="inline-flex items-center gap-1 text-emerald-600">
                        <CheckCircle2 className="h-4 w-4" /> Imported
                      </span>
                    )}
                    {r.status === "error" && (
                      <span className="inline-flex items-center gap-1 text-red-600">
                        <XCircle className="h-4 w-4" /> Failed
                      </span>
                    )}
                  </div>
                </div>

                {r.title && (
                  <div className="text-gray-900 dark:text-gray-100 font-medium">
                    {r.title} {r.id ? <span className="text-xs text-gray-500 ml-2">({r.id})</span> : null}
                  </div>
                )}

                {r.error && <div className="text-red-600 dark:text-red-400">{r.error}</div>}

                {r.id && (
                  <div className="text-xs text-gray-500">
                    View API:{" "}
                    <a
                      href={`/api/recipes/${r.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      /api/recipes/{r.id}
                    </a>
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

export default AdminImport;
