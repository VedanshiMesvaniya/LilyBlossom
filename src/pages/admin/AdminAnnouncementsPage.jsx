import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient.js";
import { adminFetch } from "../../lib/adminApi.js";

const ANNOUNCEMENT_TYPES = [
  "New Release",
  "Release Date",
  "Trailer",
  "Casting",
  "Production",
  "Streaming",
  "Poster",
  "Status Update",
  "Other GL"
];

function AnnouncementForm({ initial, busy, submitLabel, onCancel, onSubmit }) {
  const [fields, setFields] = useState({
    title: initial?.title ?? "",
    announcement_type: initial?.announcement_type ?? ANNOUNCEMENT_TYPES[0],
    summary: initial?.summary ?? "",
    content: initial?.content ?? "",
    cover_image: initial?.cover_image ?? ""
  });

  function update(key, value) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit({
      title: fields.title.trim(),
      announcement_type: fields.announcement_type,
      summary: fields.summary.trim(),
      content: fields.content.trim(),
      cover_image: fields.cover_image.trim() || undefined
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs text-text-muted">Title</span>
          <input
            value={fields.title}
            onChange={(event) => update("title", event.target.value)}
            className="rounded-md border border-border bg-surface px-2 py-1"
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-text-muted">Type</span>
          <select
            value={fields.announcement_type}
            onChange={(event) => update("announcement_type", event.target.value)}
            className="rounded-md border border-border bg-surface px-2 py-1"
          >
            {ANNOUNCEMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-text-muted">Cover image URL</span>
          <input
            value={fields.cover_image}
            onChange={(event) => update("cover_image", event.target.value)}
            className="rounded-md border border-border bg-surface px-2 py-1"
            placeholder="https://..."
          />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs text-text-muted">Summary</span>
          <textarea
            value={fields.summary}
            onChange={(event) => update("summary", event.target.value)}
            rows={2}
            className="rounded-md border border-border bg-surface px-2 py-1"
            required
          />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs text-text-muted">Content</span>
          <textarea
            value={fields.content}
            onChange={(event) => update("content", event.target.value)}
            rows={6}
            className="rounded-md border border-border bg-surface px-2 py-1"
            required
          />
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-primary px-3 py-1 text-white hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Saving..." : submitLabel}
        </button>
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

export function AnnouncementRow({ item, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
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

  async function saveEdit(fields) {
    setBusy(true);
    setError(null);
    try {
      const result = await adminFetch("/announcements", {
        method: "PATCH",
        body: JSON.stringify({ id: item.id, ...fields })
      });
      onChanged(result.announcement);
      setEditing(false);
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
          <p className="text-text-primary">{item.title}</p>
          <p className="text-xs text-text-muted">
            {item.announcement_type} · {item.status}
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <button
            onClick={() => setEditing((current) => !current)}
            disabled={busy}
            className="rounded-full border border-border px-3 py-1 hover:border-primary disabled:opacity-60"
          >
            {editing ? "Close" : "Edit"}
          </button>
          <button
            onClick={toggleStatus}
            disabled={busy}
            className="rounded-full border border-border px-3 py-1 hover:border-primary disabled:opacity-60"
          >
            {busy ? "Saving..." : item.status === "published" ? "Unpublish" : "Publish"}
          </button>
        </div>
      </div>
      {editing && (
        <div className="mt-3 border-t border-border pt-3">
          <AnnouncementForm initial={item} busy={busy} submitLabel="Save changes" onCancel={() => setEditing(false)} onSubmit={saveEdit} />
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function NewAnnouncementCard({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function create(fields) {
    setBusy(true);
    setError(null);
    try {
      const result = await adminFetch("/announcements", {
        method: "POST",
        body: JSON.stringify(fields)
      });
      onCreated(result.announcement);
      setOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-full border border-primary px-4 py-2 text-sm text-primary hover:opacity-90"
      >
        New announcement
      </button>
    );
  }

  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <AnnouncementForm busy={busy} submitLabel="Create draft" onCancel={() => setOpen(false)} onSubmit={create} />
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
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
      .select("id, title, summary, content, cover_image, announcement_type, status, created_at")
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

  function addCreated(created) {
    if (!created) return;
    setItems((current) => [created, ...current]);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 font-ui">
      <h1 className="mb-2 font-display text-3xl text-text-primary">Announcements</h1>
      <p className="mb-6 text-sm text-text-muted">
        Write a new announcement draft, edit an existing one, or publish/unpublish it.
      </p>

      <div className="mb-6">
        <NewAnnouncementCard onCreated={addCreated} />
      </div>

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
