import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient.js";
import { API_URL } from "../../lib/constants.js";

// The run button calls the small Python backend (crawler/worker.py)
// because starting a crawl needs the service-role key to queue a row
// in crawl_runs; that table has no RLS write policy for admins on
// purpose, see supabase/migrations/009_rls.sql.
function RunCrawlButton({ onQueued }) {
  const [status, setStatus] = useState("idle");

  async function handleClick() {
    setStatus("running");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${API_URL}/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`
        },
        body: JSON.stringify({ dry_run: false })
      });
      setStatus(response.ok ? "done" : "error");
      if (response.ok) onQueued?.();
    } catch {
      setStatus("error");
    }
  }

  const label =
    status === "running" ? "Starting crawler..." : status === "done" ? "Completed" : status === "error" ? "Failed, try again" : "Run Crawl Now";

  return (
    <button
      onClick={handleClick}
      disabled={status === "running"}
      className="rounded-full bg-primary px-4 py-2 text-sm text-white hover:bg-primary-hover disabled:opacity-60"
    >
      {label}
    </button>
  );
}

export function AdminCrawlerPage() {
  const [lastRun, setLastRun] = useState(null);

  function loadLastRun() {
    supabase
      .from("crawl_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setLastRun(data ?? null));
  }

  useEffect(() => {
    loadLastRun();
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 font-ui">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-3xl text-text-primary">Crawler</h1>
        <RunCrawlButton onQueued={loadLastRun} />
      </div>

      {lastRun ? (
        <dl className="grid grid-cols-2 gap-4 rounded-card border border-border bg-surface p-4 sm:grid-cols-3">
          {[
            ["Status", lastRun.status],
            ["Sources checked", lastRun.sources_checked],
            ["New titles", lastRun.new_items],
            ["Updated titles", lastRun.updated_items],
            ["Duplicates", lastRun.duplicates],
            ["Uncertain", lastRun.uncertain_items],
            ["Errors", lastRun.errors],
            ["Started", new Date(lastRun.started_at).toLocaleString()],
            ["Finished", lastRun.finished_at ? new Date(lastRun.finished_at).toLocaleString() : "In progress"]
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-text-muted">{label}</dt>
              <dd className="text-text-primary">{String(value)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-text-muted">No crawl runs recorded yet.</p>
      )}
    </div>
  );
}
