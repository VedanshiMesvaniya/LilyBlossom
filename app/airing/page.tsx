import { createClient } from "@/lib/supabase/server";
import { MediaGrid } from "@/components/MediaGrid";

export default async function AiringPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("titles")
    .select("slug, type, canonical_title, release_year, country, poster_url, release_status")
    .eq("is_published", true)
    .eq("release_status", "Airing")
    .order("release_year", { ascending: false });

  const items = (data ?? []).map((row) => ({
    slug: row.slug,
    type: row.type,
    title: row.canonical_title,
    year: row.release_year,
    country: row.country,
    posterUrl: row.poster_url,
    releaseStatus: row.release_status
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-6 font-display text-3xl text-text-primary">Currently Airing</h1>
      <MediaGrid items={items} emptyLabel="Nothing airing right now." />
    </div>
  );
}
