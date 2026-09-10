import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient.js";
import { useAuth } from "../hooks/useAuth.jsx";

export function ProfilePage() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [counts, setCounts] = useState({ watching: 0, watched: 0, plan_to_watch: 0, dropped: 0 });
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      if (signOut) {
        await signOut();
      } else {
        await supabase.auth.signOut();
      }
      navigate("/login");
    } catch (err) {
      console.error("Failed to log out:", err);
    } finally {
      setIsLoggingOut(false);
    }
  }

  if (!profile) return null;

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const completionRate = total > 0 ? Math.round((counts.watched / total) * 100) : 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 font-ui">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl text-text-primary">{profile.username}</h1>
          <p className="mt-1 text-sm text-text-muted">
            Member since {new Date(profile.created_at).toLocaleDateString()}
          </p>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="self-start rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary shadow-sm transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
        >
          {isLoggingOut ? "Logging out..." : "Log out"}
        </button>
      </div>

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
