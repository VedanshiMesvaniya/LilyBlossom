import { notFound } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { getTitleBySlug } from "@/lib/catalog/queries";
import { TrackingControls } from "@/components/TrackingControls";

export default async function MovieDetailPage({ params }: { params: { slug: string } }) {
  const supabase = createClient();
  const title = await getTitleBySlug(supabase, params.slug);
  if (!title || title.type !== "movie") notFound();

  const profile = await getCurrentProfile().catch(() => null);
  let userStatus = null;
  if (profile) {
    const { data } = await supabase
      .from("user_media_status")
      .select("status")
      .eq("user_id", profile.id)
      .eq("title_id", title.id)
      .maybeSingle();
    userStatus = data?.status ?? null;
  }

  return (
    <article className="mx-auto max-w-4xl px-4 py-10">
      <div className="grid gap-8 sm:grid-cols-[220px_1fr]">
        <div className="relative aspect-[2/3] overflow-hidden rounded-card bg-secondary">
          {title.poster_url && (
            <Image src={title.poster_url} alt={title.canonical_title} fill className="object-cover" />
          )}
        </div>

        <div className="font-ui">
          <h1 className="font-display text-3xl text-text-primary">{title.canonical_title}</h1>
          <p className="mt-1 text-text-muted">
            {[title.release_year, title.country, title.language].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-1 text-sm text-primary">{title.release_status}</p>

          {title.runtime_minutes && (
            <p className="mt-3 text-sm text-text-muted">Runtime: {title.runtime_minutes} min</p>
          )}

          {title.description && <p className="mt-4 text-sm text-text-primary">{title.description}</p>}

          <div className="mt-6">
            <TrackingControls titleId={title.id} initialStatus={userStatus} />
          </div>
        </div>
      </div>
    </article>
  );
}
