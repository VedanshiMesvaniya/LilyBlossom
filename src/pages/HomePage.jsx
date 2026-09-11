import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Hero } from "../components/Hero.jsx";
import { MediaGrid } from "../components/MediaGrid.jsx";
import { AnnouncementCard } from "../components/AnnouncementCard.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { useAuth } from "../hooks/useAuth.jsx";
import { getHomeSections } from "../lib/catalogQueries.js";

export function HomePage() {
  const { user } = useAuth();
  const [sections, setSections] = useState({ airing: [], upcoming: [], recentlyAdded: [], announcements: [] });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let isMounted = true;

    getHomeSections(supabase).then((data) => {
      if (!isMounted) return;
      setSections(data);
      setErrors(data.errors ?? {});
      setLoading(false);
    });

    if (user) {
      supabase
        .from("user_media_status")
        .select("status")
        .eq("user_id", user.id)
        .then(({ data }) => {
          if (!isMounted) return;
          const counts = { watching: 0, watched: 0, planToWatch: 0, dropped: 0 };
          for (const row of data ?? []) {
            if (row.status === "watching") counts.watching++;
            if (row.status === "watched") counts.watched++;
            if (row.status === "plan_to_watch") counts.planToWatch++;
            if (row.status === "dropped") counts.dropped++;
          }
          setStats({ total: (data ?? []).length, ...counts });
        });
    } else {
      setStats(null);
    }

    return () => {
      isMounted = false;
    };
  }, [user]);

  return (
    <div>
      <Hero stats={stats ?? undefined} />

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl text-text-primary">Currently Airing</h2>
          <Link to="/airing" className="font-ui text-sm text-primary hover:text-primary-hover">
            See all
          </Link>
        </div>
        <MediaGrid
          items={sections.airing}
          loading={loading}
          error={errors.airing}
          emptyLabel="Nothing airing right now. Check back soon."
        />
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl text-text-primary">Upcoming GL</h2>
          <Link to="/upcoming" className="font-ui text-sm text-primary hover:text-primary-hover">
            See all
          </Link>
        </div>
        <MediaGrid items={sections.upcoming} loading={loading} error={errors.upcoming} emptyLabel="No upcoming titles yet." />
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl text-text-primary">Recently Added</h2>
        </div>
        <MediaGrid
          items={sections.recentlyAdded}
          loading={loading}
          error={errors.recentlyAdded}
          emptyLabel="The catalog is still growing."
        />
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl text-text-primary">Latest Announcements</h2>
          <Link to="/announcements" className="font-ui text-sm text-primary hover:text-primary-hover">
            See all
          </Link>
        </div>
        {errors.announcements ? (
          <p className="font-ui text-sm text-red-500">Could not load announcements: {errors.announcements}</p>
        ) : !loading && sections.announcements.length === 0 ? (
          <p className="font-ui text-text-muted">No announcements published yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {sections.announcements.map((item) => (
              <AnnouncementCard
                key={item.slug}
                item={{
                  slug: item.slug,
                  title: item.title,
                  summary: item.summary,
                  coverImage: item.cover_image,
                  publishedAt: item.published_at,
                  announcementType: item.announcement_type
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
