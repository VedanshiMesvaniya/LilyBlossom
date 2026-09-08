import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { RunCrawlButton } from "./RunCrawlButton";

export default async function AdminCrawlerPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: lastRun } = await admin
    .from("crawl_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 font-ui">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-3xl text-text-primary">Crawler</h1>
        <RunCrawlButton />
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
            <div key={label as string}>
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
