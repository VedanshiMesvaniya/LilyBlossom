import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient.js";
import { adminFetch } from "../../lib/adminApi.js";

const STATE_LABELS = {
  new: "New (created, unpublished)",
  updated: "Updated (changed, unpublished)",
  existing: "Existing (unchanged, unpublished)",
  uncertain: "Uncertain match"
};

const RELEASE_STATUSES = ["Announced", "In Production", "Upcoming", "Airing", "Completed", "Cancelled"];

function emptyToUndefined(value) {
  return value === "" ? undefined : value;
}

function EditForm({ payload, onCancel, onSubmit, busy, showMerge }) {
  const [fields, setFields] = useState({
    title: payload?.title ?? "",
    type: payload?.type ?? "Series",
    year: payload?.year ?? "",
    status: payload?.status ?? "Announced",
    description: payload?.description ?? "",
    poster_url: payload?.poster_url ?? ""
  });

  function update(key, value) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  function collectOverrides() {
    return {
      title: emptyToUndefined(fields.title.trim()),
      type: fields.type,
      year: emptyToUndefined(fields.year) ? Number(fields.year) : undefined,
      status: fields.status,
      description: emptyToUndefined(fields.description.trim()),
      poster_url: emptyToUndefined(fields.poster_url.trim())
    };
  }

  function handleSubmit(event, action) {
    event.preventDefault();
    onSubmit(collectOverrides(), action);
  }

  return (
    <form onSubmit={(event) => handleSubmit(event, "publish")} className="mt-3 space-y-3 border-t border-border pt-3 text-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-text-muted">Title</span>
          <input
            value={fields.title}
            onChange={(event) => update("title", event.target.value)}
            className="rounded-md border border-border bg-surface px-2 py-1"
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-text-muted">Year</span>
          <input
            type="number"
            value={fields.year}
            onChange={(event) => update("year", event.target.value)}
            className="rounded-md border border-border bg-surface px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-text-muted">Type</span>
          <select
            value={fields.type}
            onChange={(event) => update("type", event.target.value)}
            className="rounded-md border border-border bg-surface px-2 py-1"
          >
            <option value="Series">Series</option>
            <option value="Movie">Movie</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-text-muted">Release status</span>
          <select
            value={fields.status}
            onChange={(event) => update("status", event.target.value)}
            className="rounded-md border border-border bg-surface px-2 py-1"
          >
            {RELEASE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs text-text-muted">Poster URL</span>
          <input
            value={fields.poster_url}
            onChange={(event) => update("poster_url", event.target.value)}
            className="rounded-md border border-border bg-surface px-2 py-1"
            placeholder="https://..."
          />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs text-text-muted">Description</span>
          <textarea
            value={fields.description}
            onChange={(event) => update("description", event.target.value)}
            rows={3}
            className="rounded-md border border-border bg-surface px-2 py-1"
          />
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-primary px-3 py-1 text-white hover:opacity-90 disabled:opacity-60"
        >
          {busy === "publish" ? "Saving..." : "Save & publish"}
        </button>
        {showMerge && (
          <button
            type="button"
            onClick={(event) => handleSubmit(event, "merge")}
            disabled={busy}
            className="rounded-full border border-primary px-3 py-1 text-primary hover:opacity-90 disabled:opacity-60"
          >
            {busy === "merge" ? "Saving..." : "Save & merge"}
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-full border border-border px-3 py-1 hover:border-primary disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function ReviewItem({ item, onResolved }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);

  async function act(action, overrides) {
    setBusy(action);
    setError(null);
    try {
      const hasOverrides = overrides && Object.keys(overrides).length > 0;
      await adminFetch(`/review/${item.id}/${action}`, {
        method: "POST",
        ...(hasOverrides ? { body: JSON.stringify(overrides) } : {})
      });
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
            onClick={() => setEditing((current) => !current)}
            disabled={Boolean(busy)}
            className="rounded-full border border-border px-3 py-1 hover:border-primary disabled:opacity-60"
            title="Correct a field before publishing or merging"
          >
            {editing ? "Close" : "Edit"}
          </button>
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
      {editing && (
        <EditForm
          payload={item.payload}
          busy={busy}
          showMerge={isUncertain}
          onCancel={() => setEditing(false)}
          onSubmit={(overrides, action) => act(action, overrides)}
        />
      )}
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
      .select("id, raw_title, state, match_confidence, source_id, detected_at, payload")
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
      <h1 className="mb-2 font-display text-3xl text-text-primary">Review Queue</h1>
      <p className="mb-6 text-sm text-text-muted">
        Publish or merge as the crawler found it, or press Edit to correct a field first.
      </p>

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
