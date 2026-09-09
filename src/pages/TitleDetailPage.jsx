import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { NotFoundPage } from "./NotFoundPage.jsx";
import { TrackingControls } from "../components/TrackingControls.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { useAuth } from "../hooks/useAuth.jsx";
import { getTitleBySlug } from "../lib/catalogQueries.js";

// Shared by /series/:slug and /movies/:slug, since the two pages were
// identical except for one detail field (episode_count vs
// runtime_minutes) and the notFound() check on type.
export function TitleDetailPage({ type }) {
  const { slug } = useParams();
  const { user } = useAuth();
  const [title, setTitle] = useState(null);
  const [userStatus, setUserStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const data = await getTitleBySlug(supabase, slug);
      if (!isMounted) return;

      if (!data || data.type !== type) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setTitle(data);

      if (user) {
        const { data: statusRow } = await supabase
          .from("user_media_status")
          .select("status")
          .eq("user_id", user.id)
          .eq("title_id", data.id)
          .maybeSingle();
        if (isMounted) setUserStatus(statusRow?.status ?? null);
      }

      setLoading(false);
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [slug, type, user]);

  if (loading) return null;
  if (notFound) return <NotFoundPage />;

  return (
    <article className="mx-auto max-w-4xl px-4 py-10">
      <div className="grid gap-8 sm:grid-cols-[220px_1fr]">
        <div className="relative aspect-[2/3] overflow-hidden rounded-card bg-secondary">
          {title.poster_url && (
            <img
              src={title.poster_url}
              alt={title.canonical_title}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          )}
        </div>

        <div className="font-ui">
          <h1 className="font-display text-3xl text-text-primary">{title.canonical_title}</h1>
          <p className="mt-1 text-text-muted">
            {[title.release_year, title.country, title.language].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-1 text-sm text-primary">{title.release_status}</p>

          {type === "series" && title.episode_count && (
            <p className="mt-3 text-sm text-text-muted">Episodes: {title.episode_count}</p>
          )}
          {type === "movie" && title.runtime_minutes && (
            <p className="mt-3 text-sm text-text-muted">Runtime: {title.runtime_minutes} min</p>
          )}

          {title.description && <p className="mt-4 text-sm text-text-primary">{title.description}</p>}

          {user && (
            <div className="mt-6">
              <TrackingControls titleId={title.id} initialStatus={userStatus} />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
