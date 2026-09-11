import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient.js";
import { adminFetch } from "../../lib/adminApi.js";

const POLL_INTERVAL_MS = 2000;
const ACTIVE_STATUSES = new Set(["queued", "running"]);

const STATUS_LABELS = {
  queued: "Queued...",
  running: "Crawler running...",
  success: "Completed",
  partial_success: "Completed with some errors",
  failed: "Failed"
};

function RunCrawlButton({ activeRun, onStarted, onError }) {
  const [starting, setStarting] = useState(false);

  async function handleClick() {
    setStarting(true);
    onError(null);
    try {
      const result = await adminFetch("/run", { method: "POST", body: JSON.stringify({ dry_run: false }) });
      onStarted(result.run_id);
    } catch (err) {
      onError(err.message);
    } finally {
      setStarting(false);
    }
  }

  const busy = starting || Boolean(activeRun);
  const label = starting ? "Starting..." : activeRun ? STATUS_LABELS[activeRun.status] ?? "Running..." : "Run Crawl Now";

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      className="rounded-full bg-primary px-4 py-2 text-sm text-white hover:bg-primary-hover disabled:opacity-60"
    >
      {label}
    </button>
  );
}

export function AdminCrawlerPage() {
  const [lastRun, setLastRun] = useState(null);
  const [error, setError] = useState(null);

  function loadLastRun() {
    supabase
      .from("crawl_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error: queryError }) => {
        if (queryError) {
          setError(queryError.message);
          return;
        }
        setLastRun(data ?? null);
      });
  }

  useEffect(() => {
    loadLastRun();
  }, []);

  // Polls GET /runs/{id} every two seconds while a run is queued or
  // running, and stops as soon as it reaches a final status. This
  // replaces the old "load once, hope it finished" admin page, which
  // is what let the UI show "Completed" for a run still in progress.
  useEffect(() => {
    const runId = lastRun?.id;
    const status = lastRun?.status;
    if (!runId || !ACTIVE_STATUSES.has(status)) return;

    const interval = setInterval(async () => {
      try {
        const result = await adminFetch(`/runs/${runId}`);
        setLastRun(result.run);
        if (!ACTIVE_STATUSES.has(result.run.status)) clearInterval(interval);
      } catch (err) {
        setError(err.message);
        clearInterval(interval);
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [lastRun?.id, lastRun?.status]);

  function handleStarted(runId) {
    setLastRun({ id: runId, status: "queued" });
  }

  const isActive = lastRun && ACTIVE_STATUSES.has(lastRun.status);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 font-ui">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-3xl text-text-primary">Crawler</h1>
        <RunCrawlButton activeRun={isActive ? lastRun : null} onStarted={handleStarted} onError={setError} />
      </div>

      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      {lastRun ? (
        <>
          <dl className="grid grid-cols-2 gap-4 rounded-card border border-border bg-surface p-4 sm:grid-cols-3">
            {[
              ["Status", STATUS_LABELS[lastRun.status] ?? lastRun.status],
              ["Sources checked", lastRun.sources_checked ?? "-"],
              ["New titles", lastRun.new_items ?? "-"],
              ["Updated titles", lastRun.updated_items ?? "-"],
              ["Existing (unchanged)", lastRun.duplicates ?? "-"],
              ["Uncertain", lastRun.uncertain_items ?? "-"],
              ["Errors", lastRun.errors ?? "-"],
              ["Started", lastRun.started_at ? new Date(lastRun.started_at).toLocaleString() : "-"],
              ["Finished", lastRun.finished_at ? new Date(lastRun.finished_at).toLocaleString() : "In progress"]
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-text-muted">{label}</dt>
                <dd className="text-text-primary">{String(value)}</dd>
              </div>
            ))}
          </dl>

          {Array.isArray(lastRun.source_results) && lastRun.source_results.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-2 font-display text-lg text-text-primary">Sources this run</h2>
              <div className="space-y-2">
                {lastRun.source_results.map((source) => (
                  <div
                    key={source.name}
                    className="flex items-center justify-between rounded-card border border-border bg-surface px-4 py-2 text-sm"
                  >
                    <span className="text-text-primary">{source.name}</span>
                    <span className={source.status === "OK" ? "text-primary" : "text-text-muted"}>
                      {source.status} · {source.items_found} item{source.items_found === 1 ? "" : "s"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="text-text-muted">No crawl runs recorded yet.</p>
      )}
    </div>
  );
}
