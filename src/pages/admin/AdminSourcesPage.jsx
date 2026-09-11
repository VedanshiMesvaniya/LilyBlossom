import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient.js";
import { adminFetch } from "../../lib/adminApi.js";

function SourceRow({ source, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function toggleEnabled() {
    setBusy(true);
    setError(null);
    try {
      const result = await adminFetch("/sources", {
        method: "PATCH",
        body: JSON.stringify({ id: source.id, enabled: !source.enabled })
      });
      onChanged(result.source);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function changePriority(nextPriority) {
    setBusy(true);
    setError(null);
    try {
      const result = await adminFetch("/sources", {
        method: "PATCH",
        body: JSON.stringify({ id: source.id, priority: nextPriority })
      });
      onChanged(result.source);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-text-primary">{source.name}</p>
          <p className="mt-1 text-xs text-text-muted">{source.url}</p>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <label className="flex items-center gap-2 text-xs text-text-muted">
            Priority
            <input
              type="number"
              defaultValue={source.priority ?? 0}
              onBlur={(event) => {
                const next = Number(event.target.value);
                if (!Number.isNaN(next) && next !== source.priority) changePriority(next);
              }}
              disabled={busy}
              className="w-16 rounded-full border border-border bg-background px-2 py-1 text-center text-text-primary"
            />
          </label>

          <button
            onClick={toggleEnabled}
            disabled={busy}
            className={`rounded-full border px-3 py-1 text-xs disabled:opacity-60 ${
              source.enabled
                ? "border-primary text-primary hover:bg-primary hover:text-white"
                : "border-border text-text-muted hover:border-primary"
            }`}
          >
            {source.enabled ? "Enabled" : "Disabled"}
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
        {source.last_crawled_at && <span>Last crawled: {new Date(source.last_crawled_at).toLocaleString()}</span>}
        {source.last_success_at && <span>Last success: {new Date(source.last_success_at).toLocaleString()}</span>}
      </div>
      {source.last_error && <p className="mt-1 text-xs text-red-600">Last error: {source.last_error}</p>}
      {error && <p className="mt-1 text-xs text-red-600">Could not update: {error}</p>}
    </div>
  );
}

export function AdminSourcesPage() {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    supabase
      .from("sources")
      .select("id, name, url, enabled, priority, source_type, last_crawled_at, last_success_at, last_error")
      .order("priority", { ascending: true })
      .then(({ data, error: queryError }) => {
        if (!isMounted) return;
        setSources(data ?? []);
        setError(queryError?.message ?? null);
        setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  function applyChange(updated) {
    if (!updated) return;
    setSources((current) =>
      [...current.map((source) => (source.id === updated.id ? { ...source, ...updated } : source))].sort(
        (a, b) => (a.priority ?? 0) - (b.priority ?? 0)
      )
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 font-ui">
      <h1 className="mb-2 font-display text-3xl text-text-primary">Sources</h1>
      <p className="mb-6 text-sm text-text-muted">
        Only enabled sources run on the next crawl. Priority controls the order they run in (lower runs first).
      </p>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-card border border-border bg-surface" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-red-500">Could not load sources: {error}</p>
      ) : sources.length === 0 ? (
        <p className="text-text-muted">
          No sources configured yet. Run supabase/migrations/012_seed_sources.sql to add the current adapters.
        </p>
      ) : (
        <div className="space-y-3">
          {sources.map((source) => (
            <SourceRow key={source.id} source={source} onChanged={applyChange} />
          ))}
        </div>
      )}
    </div>
  );
}
