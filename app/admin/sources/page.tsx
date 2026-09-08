import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminSourcesPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: sources } = await admin
    .from("sources")
    .select("id, name, url, enabled, source_type, last_crawled_at, last_success_at, last_error")
    .order("priority", { ascending: true });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 font-ui">
      <h1 className="mb-6 font-display text-3xl text-text-primary">Sources</h1>

      <div className="space-y-3">
        {(sources ?? []).map((source) => (
          <div key={source.id} className="rounded-card border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <p className="text-text-primary">{source.name}</p>
              <span className={`text-xs ${source.enabled ? "text-primary" : "text-text-muted"}`}>
                {source.enabled ? "Enabled" : "Disabled"}
              </span>
            </div>
            <p className="mt-1 text-xs text-text-muted">{source.url}</p>
            {source.last_error && <p className="mt-1 text-xs text-red-600">Last error: {source.last_error}</p>}
          </div>
        ))}

        {(sources ?? []).length === 0 && <p className="text-text-muted">No sources configured yet.</p>}
      </div>
    </div>
  );
}
