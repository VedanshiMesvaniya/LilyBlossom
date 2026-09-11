import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { NotFoundPage } from "./NotFoundPage.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { getAnnouncementBySlug } from "../lib/catalogQueries.js";

export function AnnouncementDetailPage() {
  const { slug } = useParams();
  const [announcement, setAnnouncement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    getAnnouncementBySlug(supabase, slug).then(({ data, error: queryError }) => {
      if (isMounted) {
        setAnnouncement(data);
        setError(queryError);
        setLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl animate-pulse px-4 py-10">
        <div className="h-4 w-16 rounded bg-secondary/60" />
        <div className="mt-3 h-8 w-3/4 rounded bg-secondary/60" />
        <div className="mt-6 aspect-video rounded-card bg-secondary/60" />
      </div>
    );
  }
  if (error) {
    return (
      <p className="mx-auto max-w-2xl px-4 py-10 text-center font-ui text-sm text-red-500">
        Could not load this announcement: {error}
      </p>
    );
  }
  if (!announcement) return <NotFoundPage />;

  return (
    <article className="mx-auto max-w-2xl px-4 py-10 font-ui">
      <p className="text-xs text-primary">{announcement.announcement_type}</p>
      <h1 className="mt-1 font-display text-3xl text-text-primary">{announcement.title}</h1>
      <p className="mt-1 text-xs text-text-muted">{announcement.published_at}</p>

      {announcement.cover_image && (
        <div className="relative mt-6 aspect-video overflow-hidden rounded-card">
          <img
            src={announcement.cover_image}
            alt={announcement.title}
            className="h-full w-full object-cover"
          />
        </div>
      )}

      <div className="mt-6 whitespace-pre-line text-text-primary">{announcement.content}</div>

      {announcement.source_url && (
        <p className="mt-6 text-sm text-text-muted">
          Source:{" "}
          <a href={announcement.source_url} className="text-primary hover:text-primary-hover">
            {announcement.source_name ?? "Original source"}
          </a>
        </p>
      )}
    </article>
  );
}
