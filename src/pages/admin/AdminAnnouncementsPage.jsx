import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient.js";
import { adminFetch } from "../../lib/adminApi.js";

function AnnouncementRow({ item, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const nextStatus = item.status === "published" ? "unpublished" : "published";

  async function toggleStatus() {
    setBusy(true);
    setError(null);
    try {
      const result = await adminFetch("/announcements", {
        method: "PATCH",
        body: JSON.stringify({ id: item.id, status: nextStatus })
      });
      onChanged(result.announcement);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between rounded-card border border-border bg-surface p-4">
      <div>
        <p className="text-text-primary">{item.title}</p>
        <p className="text-xs text-text-muted">
          {item.announcement_type} · {item.status}
        </p>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
      <div className="flex gap-2 text-sm">
        <button
          onClick={toggleStatus}
          disabled={busy}
          className="rounded-full border border-border px-3 py-1 hover:border-primary disabled:opacity-60"
        >
          {busy ? "Saving..." : item.status === "published" ? "Unpublish" : "Publish"}
        </button>
      </div>
    </div>
  );
}

export function AdminAnnouncementsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    supabase
      .from("announcements")
      .select("id, title, announcement_type, status, created_at")
      .order("created_at", { ascending: false })
      .then(({ data, error: queryError }) => {
        if (!isMounted) return;
        setItems(data ?? []);
        setError(queryError?.message ?? null);
        setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  function applyChange(updated) {
    if (!updated) return;
    setItems((current) => current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 font-ui">
      <h1 className="mb-2 font-display text-3xl text-text-primary">Announcements</h1>
      <p className="mb-6 text-sm text-text-muted">
        There is no announcement content editor yet, drafts are created directly in the database or by a future
        announcement source. This page publishes or unpublishes what already exists.
      </p>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-card border border-border bg-surface" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-red-500">Could not load announcements: {error}</p>
      ) : items.length === 0 ? (
        <p className="text-text-muted">No announcement drafts yet.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <AnnouncementRow key={item.id} item={item} onChanged={applyChange} />
          ))}
        </div>
      )}
    </div>
  );
}
