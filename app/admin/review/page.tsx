import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminReviewPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: pendingItems } = await admin
    .from("crawl_items")
    .select("id, raw_title, state, match_confidence, source_id, detected_at")
    .in("state", ["new", "uncertain"])
    .order("detected_at", { ascending: false });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 font-ui">
      <h1 className="mb-6 font-display text-3xl text-text-primary">Review Queue</h1>

      {(pendingItems ?? []).length === 0 ? (
        <p className="text-text-muted">Nothing waiting for review.</p>
      ) : (
        <div className="space-y-3">
          {pendingItems!.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-card border border-border bg-surface p-4">
              <div>
                <p className="text-text-primary">{item.raw_title}</p>
                <p className="text-xs text-text-muted">
                  {item.state} · confidence {item.match_confidence ?? "n/a"}
                </p>
              </div>
              <div className="flex gap-2 text-sm">
                <button className="rounded-full border border-border px-3 py-1 hover:border-primary">Publish</button>
                <button className="rounded-full border border-border px-3 py-1 hover:border-primary">Reject</button>
                <button className="rounded-full border border-border px-3 py-1 hover:border-primary">Merge</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
