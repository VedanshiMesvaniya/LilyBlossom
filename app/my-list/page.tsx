import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { MediaGrid } from "@/components/MediaGrid";
import type { WatchStatus } from "@/lib/constants";

const TABS: { key: WatchStatus; label: string }[] = [
  { key: "plan_to_watch", label: "Plan to Watch" },
  { key: "watching", label: "Watching" },
  { key: "watched", label: "Watched" },
  { key: "dropped", label: "Dropped" }
];

export default async function MyListPage({ searchParams }: { searchParams: { tab?: string } }) {
  const profile = await getCurrentProfile().catch(() => null);
  if (!profile) redirect("/login?next=/my-list");

  const activeTab = (searchParams.tab as WatchStatus) ?? "watching";
  const supabase = createClient();

  const { data } = await supabase
    .from("user_media_status")
    .select("status, current_episode, progress, titles(slug, type, canonical_title, release_year, country, poster_url, release_status)")
    .eq("user_id", profile.id)
    .eq("status", activeTab);

  const items = (data ?? [])
    .map((row: any) => {
      const t = row.titles;
      if (!t) return null;
      return {
        slug: t.slug,
        type: t.type,
        title: t.canonical_title,
        year: t.release_year,
        country: t.country,
        posterUrl: t.poster_url,
        releaseStatus: t.release_status,
        userStatus: row.status,
        progressPercentage: row.progress
      };
    })
    .filter(Boolean);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-6 font-display text-3xl text-text-primary">My List</h1>

      <div className="mb-6 flex flex-wrap gap-2 font-ui text-sm">
        {TABS.map((tab) => (
          <a
            key={tab.key}
            href={`/my-list?tab=${tab.key}`}
            className={`rounded-full border px-3 py-1.5 ${
              activeTab === tab.key
                ? "border-primary bg-primary text-white"
                : "border-border bg-surface text-text-primary hover:border-primary"
            }`}
          >
            {tab.label}
          </a>
        ))}
      </div>

      <MediaGrid items={items as any} emptyLabel="Nothing here yet. Go add something to your list." />
    </div>
  );
}
