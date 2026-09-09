import { useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { WATCH_STATUSES, WATCH_STATUS_LABELS } from "../lib/constants.js";
import { useAuth } from "../hooks/useAuth.jsx";

/**
 * Lets a signed-in user set their personal status for one title.
 * Writes straight to user_media_status as the signed-in user; the
 * global title record is never touched from here (see
 * docs/DATABASE.md, "personal state" section). Row Level Security
 * (see supabase/migrations/009_rls.sql) already restricts every row
 * to its own owner, so this is safe to call directly from the browser.
 */
export function TrackingControls({ titleId, initialStatus }) {
  const { user } = useAuth();
  const [status, setStatus] = useState(initialStatus);
  const [isPending, setIsPending] = useState(false);

  async function handleSelect(next) {
    if (!user) return;
    setIsPending(true);
    const { error } = await supabase.from("user_media_status").upsert(
      {
        user_id: user.id,
        title_id: titleId,
        status: next,
        updated_at: new Date().toISOString()
      },
      { onConflict: "user_id,title_id" }
    );
    setIsPending(false);
    if (!error) setStatus(next);
  }

  return (
    <div className="flex flex-wrap gap-2 font-ui text-sm">
      {WATCH_STATUSES.map((option) => (
        <button
          key={option}
          type="button"
          disabled={isPending}
          onClick={() => handleSelect(option)}
          className={`rounded-full border px-3 py-1.5 ${
            status === option
              ? "border-primary bg-primary text-white"
              : "border-border bg-surface text-text-primary hover:border-primary"
          }`}
        >
          {WATCH_STATUS_LABELS[option]}
        </button>
      ))}
    </div>
  );
}
