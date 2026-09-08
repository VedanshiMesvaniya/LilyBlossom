import Link from "next/link";
import { Hero } from "@/components/Hero";
import { MediaGrid } from "@/components/MediaGrid";
import { AnnouncementCard } from "@/components/AnnouncementCard";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { getHomeSections } from "@/lib/catalog/queries";

export default async function HomePage() {
  const supabase = createClient();
  const [profile, sections] = await Promise.all([
    getCurrentProfile().catch(() => null),
    getHomeSections(supabase).catch(() => ({ airing: [], upcoming: [], recentlyAdded: [] }))
  ]);

  let stats;
  if (profile) {
    const { data } = await supabase
      .from("user_media_status")
      .select("status")
      .eq("user_id", profile.id);

    const counts = { watching: 0, watched: 0, planToWatch: 0, dropped: 0 };
    for (const row of data ?? []) {
      if (row.status === "watching") counts.watching++;
      if (row.status === "watched") counts.watched++;
      if (row.status === "plan_to_watch") counts.planToWatch++;
      if (row.status === "dropped") counts.dropped++;
    }
    stats = { total: (data ?? []).length, ...counts };
  }

  return (
    <div>
      <Hero stats={stats} />

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl text-text-primary">Currently Airing</h2>
          <Link href="/airing" className="font-ui text-sm text-primary hover:text-primary-hover">
            See all
          </Link>
        </div>
        <MediaGrid items={sections.airing} emptyLabel="Nothing airing right now. Check back soon." />
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl text-text-primary">Upcoming GL</h2>
          <Link href="/upcoming" className="font-ui text-sm text-primary hover:text-primary-hover">
            See all
          </Link>
        </div>
        <MediaGrid items={sections.upcoming} emptyLabel="No upcoming titles yet." />
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl text-text-primary">Recently Added</h2>
        </div>
        <MediaGrid items={sections.recentlyAdded} emptyLabel="The catalog is still growing." />
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="mb-4 font-display text-2xl text-text-primary">Latest Announcements</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <AnnouncementPlaceholder />
        </div>
      </section>
    </div>
  );
}

// Rendered until the announcements table has published rows. Kept as a
// tiny component so it is obvious where to wire in the real query.
function AnnouncementPlaceholder() {
  return <p className="font-ui text-text-muted">No announcements published yet.</p>;
}
