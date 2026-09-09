import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { useAuth } from "../hooks/useAuth.jsx";

export function ProfilePage() {
  const { profile } = useAuth();
  const [counts, setCounts] = useState({ watching: 0, watched: 0, plan_to_watch: 0, dropped: 0 });

  useEffect(() => {
    if (!profile) return;
    let isMounted = true;

    supabase
      .from("user_media_status")
      .select("status")
      .eq("user_id", profile.id)
      .then(({ data }) => {
        if (!isMounted) return;
        const next = { watching: 0, watched: 0, plan_to_watch: 0, dropped: 0 };
        for (const row of data ?? []) next[row.status] = (next[row.status] ?? 0) + 1;
        setCounts(next);
      });

    return () => {
      isMounted = false;
    };
  }, [profile]);

  if (!profile) return null;

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const completionRate = total > 0 ? Math.round((counts.watched / total) * 100) : 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 font-ui">
      <h1 className="font-display text-3xl text-text-primary">{profile.username}</h1>
      <p className="mt-1 text-sm text-text-muted">
        Member since {new Date(profile.created_at).toLocaleDateString()}
      </p>

      <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[
          ["Watched", counts.watched],
          ["Watching", counts.watching],
          ["Plan to Watch", counts.plan_to_watch],
          ["Dropped", counts.dropped],
          ["Completion Rate", `${completionRate}%`]
        ].map(([label, value]) => (
          <div key={label} className="rounded-card border border-border bg-surface p-4">
            <dt className="text-xs text-text-muted">{label}</dt>
            <dd className="mt-1 text-xl text-text-primary">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
