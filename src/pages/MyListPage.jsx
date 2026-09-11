import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { MediaGrid } from "../components/MediaGrid.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { useAuth } from "../hooks/useAuth.jsx";

const TABS = [
  { key: "plan_to_watch", label: "Plan to Watch" },
  { key: "watching", label: "Watching" },
  { key: "watched", label: "Watched" },
  { key: "dropped", label: "Dropped" }
];

export function MyListPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "watching";
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    setLoading(true);

    supabase
      .from("user_media_status")
      .select(
        "status, current_episode, progress, titles(canonical_slug, type, canonical_title, release_year, country, poster_url, release_status)"
      )
      .eq("user_id", user.id)
      .eq("status", activeTab)
      .then(({ data, error: queryError }) => {
        if (!isMounted) return;
        if (queryError) {
          setError(queryError.message);
          setItems([]);
          setLoading(false);
          return;
        }
        setError(null);
        const mapped = (data ?? [])
          .map((row) => {
            const t = row.titles;
            if (!t) return null;
            return {
              slug: t.canonical_slug,
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
        setItems(mapped);
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user, activeTab]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-6 font-display text-3xl text-text-primary">My List</h1>

      <div className="mb-6 flex flex-wrap gap-2 font-ui text-sm">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            to={`/my-list?tab=${tab.key}`}
            className={`rounded-full border px-3 py-1.5 ${
              activeTab === tab.key
                ? "border-primary bg-primary text-white"
                : "border-border bg-surface text-text-primary hover:border-primary"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <MediaGrid
        items={items}
        loading={loading}
        error={error}
        emptyLabel="Nothing here yet. Go add something to your list."
      />
    </div>
  );
}
