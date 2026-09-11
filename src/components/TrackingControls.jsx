import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { WATCH_STATUSES, WATCH_STATUS_LABELS } from "../lib/constants.js";
import { useAuth } from "../hooks/useAuth.jsx";

/**
 * Lets a signed-in user set their personal status, progress, and
 * favorite flag for one title. Writes straight to user_media_status
 * as the signed-in user; the global title record is never touched
 * from here (see docs/DATABASE.md, "personal state" section). Row
 * Level Security (see supabase/migrations/009_rls.sql) already
 * restricts every row to its own owner, so this is safe to call
 * directly from the browser.
 *
 * Loads its own current state instead of taking it as a prop, since
 * is_favorite and progress previously had no UI at all despite being
 * real columns on user_media_status (003_user_tracking.sql) that
 * MyListPage.jsx already reads.
 */
export function TrackingControls({ titleId }) {
  const { user } = useAuth();
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let isMounted = true;
    supabase
      .from("user_media_status")
      .select("status, progress, is_favorite")
      .eq("user_id", user.id)
      .eq("title_id", titleId)
      .maybeSingle()
      .then(({ data, error: queryError }) => {
        if (!isMounted) return;
        setEntry(data ?? null);
        setError(queryError?.message ?? null);
        setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [user, titleId]);

  async function save(patch) {
    if (!user) return;
    setSaving(true);
    setError(null);

    // A favorite toggle before the user ever picked a status still
    // needs one, since status is required; plan_to_watch is the same
    // default a brand new row would otherwise have.
    const nextRow = {
      user_id: user.id,
      title_id: titleId,
      status: entry?.status ?? "plan_to_watch",
      progress: entry?.progress ?? null,
      is_favorite: entry?.is_favorite ?? false,
      ...patch,
      updated_at: new Date().toISOString()
    };

    const { data, error: saveError } = await supabase
      .from("user_media_status")
      .upsert(nextRow, { onConflict: "user_id,title_id" })
      .select("status, progress, is_favorite")
      .single();

    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    // Read back rather than trust `patch`: a trigger flips status to
    // "watched" once progress reaches 100 (003_user_tracking.sql), so
    // the saved row can differ from what was sent.
    setEntry(data);
  }

  if (!user || loading) return null;

  const status = entry?.status ?? null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 font-ui text-sm">
        {WATCH_STATUSES.map((option) => (
          <button
            key={option}
            type="button"
            disabled={saving}
            onClick={() => save({ status: option })}
            className={`rounded-full border px-3 py-1.5 disabled:opacity-60 ${
              status === option
                ? "border-primary bg-primary text-white"
                : "border-border bg-surface text-text-primary hover:border-primary"
            }`}
          >
            {WATCH_STATUS_LABELS[option]}
          </button>
        ))}

        <button
          type="button"
          disabled={saving}
          onClick={() => save({ is_favorite: !entry?.is_favorite })}
          aria-pressed={Boolean(entry?.is_favorite)}
          title={entry?.is_favorite ? "Remove from favorites" : "Add to favorites"}
          className={`rounded-full border px-3 py-1.5 disabled:opacity-60 ${
            entry?.is_favorite
              ? "border-primary bg-primary text-white"
              : "border-border bg-surface text-text-primary hover:border-primary"
          }`}
        >
          {entry?.is_favorite ? "♥ Favorited" : "♡ Favorite"}
        </button>
      </div>

      {status === "watching" && (
        <label className="flex items-center gap-3 font-ui text-sm text-text-primary">
          Progress
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={entry?.progress ?? 0}
            disabled={saving}
            onChange={(event) => save({ progress: Number(event.target.value) })}
            className="w-40 accent-primary"
          />
          <span className="w-10 text-text-muted">{entry?.progress ?? 0}%</span>
        </label>
      )}

      {error && <p className="font-ui text-xs text-red-600">Could not save: {error}</p>}
    </div>
  );
}
