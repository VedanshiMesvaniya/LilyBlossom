import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnnouncementCard } from "../components/AnnouncementCard.jsx";
import { Pagination } from "../components/Pagination.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { getPublishedAnnouncements, DEFAULT_PAGE_SIZE } from "../lib/catalogQueries.js";

export function AnnouncementsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const page = Number(searchParams.get("page") ?? "1");

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    getPublishedAnnouncements(supabase, { page, pageSize: DEFAULT_PAGE_SIZE }).then(
      ({ data, count: total, error: queryError }) => {
        if (!isMounted) return;
        setItems(data);
        setCount(total);
        setError(queryError);
        setLoading(false);
      }
    );
    return () => {
      isMounted = false;
    };
  }, [page]);

  function goToPage(nextPage) {
    setSearchParams({ page: String(nextPage) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-6 font-display text-3xl text-text-primary">GL Announcements</h1>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-card border border-border bg-surface" />
          ))}
        </div>
      ) : error ? (
        <p className="font-ui text-sm text-red-500">Could not load announcements: {error}</p>
      ) : items.length === 0 ? (
        <p className="font-ui text-text-muted">No announcements published yet.</p>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
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

      {!loading && !error && (
        <Pagination page={page} pageSize={DEFAULT_PAGE_SIZE} count={count} onPageChange={goToPage} />
      )}
    </div>
  );
}
