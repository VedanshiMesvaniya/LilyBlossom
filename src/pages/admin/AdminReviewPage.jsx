import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient.js";
import { adminFetch } from "../../lib/adminApi.js";

const STATE_LABELS = {
  new: "New (created, unpublished)",
  updated: "Updated (changed, unpublished)",
  existing: "Existing (unchanged, unpublished)",
  uncertain: "Uncertain match"
};

function ReviewItem({ item, onResolved }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  async function act(action) {
    setBusy(action);
    setError(null);
    try {
      await adminFetch(`/review/${item.id}/${action}`, { method: "POST" });
      onResolved(item.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  const isUncertain = item.state === "uncertain";

  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-text-primary">{item.raw_title}</p>
          <p className="text-xs text-text-muted">
            {STATE_LABELS[item.state] ?? item.state} · confidence{" "}
            {item.match_confidence != null ? item.match_confidence.toFixed(2) : "n/a"}
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <button
            onClick={() => act("publish")}
            disabled={Boolean(busy)}
            className="rounded-full border border-border px-3 py-1 hover:border-primary disabled:opacity-60"
            title={isUncertain ? "Create this as a new, published title" : "Publish this title"}
          >
            {busy === "publish" ? "Publishing..." : "Publish"}
          </button>
          {isUncertain && (
            <button
              onClick={() => act("merge")}
              disabled={Boolean(busy)}
              className="rounded-full border border-border px-3 py-1 hover:border-primary disabled:opacity-60"
              title="Confirm this is the same title it matched, and apply its details"
            >
              {busy === "merge" ? "Merging..." : "Merge"}
            </button>
          )}
          <button
            onClick={() => act("reject")}
            disabled={Boolean(busy)}
            className="rounded-full border border-border px-3 py-1 hover:border-primary disabled:opacity-60"
          >
            {busy === "reject" ? "Rejecting..." : "Reject"}
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function AdminReviewPage() {
  const [pendingItems, setPendingItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function load() {
    setLoading(true);
    supabase
      .from("crawl_items")
      .select("id, raw_title, state, match_confidence, source_id, detected_at")
      .in("state", ["new", "updated", "existing", "uncertain"])
      .order("detected_at", { ascending: false })
      .then(({ data, error: queryError }) => {
        setPendingItems(data ?? []);
        setError(queryError?.message ?? null);
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
  }, []);

  function handleResolved(itemId) {
    setPendingItems((current) => current.filter((item) => item.id !== itemId));
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 font-ui">
      <h1 className="mb-6 font-display text-3xl text-text-primary">Review Queue</h1>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-card border border-border bg-surface" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-red-500">Could not load the review queue: {error}</p>
      ) : pendingItems.length === 0 ? (
        <p className="text-text-muted">Nothing waiting for review.</p>
      ) : (
        <div className="space-y-3">
          {pendingItems.map((item) => (
            <ReviewItem key={item.id} item={item} onResolved={handleResolved} />
          ))}
        </div>
      )}
    </div>
  );
}
