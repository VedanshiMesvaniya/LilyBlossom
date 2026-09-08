import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/session";

export default async function ProfilePage() {
  const profile = await getCurrentProfile().catch(() => null);
  if (!profile) redirect("/login?next=/profile");

  const supabase = createClient();
  const { data } = await supabase.from("user_media_status").select("status").eq("user_id", profile.id);

  const counts = { watching: 0, watched: 0, plan_to_watch: 0, dropped: 0 } as Record<string, number>;
  for (const row of data ?? []) counts[row.status] = (counts[row.status] ?? 0) + 1;

  const total = (data ?? []).length;
  const completionRate = total > 0 ? Math.round((counts.watched / total) * 100) : 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 font-ui">
      <h1 className="font-display text-3xl text-text-primary">{profile.username}</h1>
      <p className="mt-1 text-sm text-text-muted">Member since {new Date(profile.created_at).toLocaleDateString()}</p>

      <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[
          ["Watched", counts.watched],
          ["Watching", counts.watching],
          ["Plan to Watch", counts.plan_to_watch],
          ["Dropped", counts.dropped],
          ["Completion Rate", `${completionRate}%`]
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-card border border-border bg-surface p-4">
            <dt className="text-xs text-text-muted">{label}</dt>
            <dd className="mt-1 text-xl text-text-primary">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
