import { createClient } from "@/lib/supabase/server";
import { MediaGrid } from "@/components/MediaGrid";

export default async function UpcomingPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("titles")
    .select("slug, type, canonical_title, release_year, country, poster_url, release_status, release_date")
    .eq("is_published", true)
    .in("release_status", ["Announced", "In Production", "Upcoming"])
    .order("release_date", { ascending: true });

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
      <h1 className="mb-6 font-display text-3xl text-text-primary">Upcoming GL</h1>
      <MediaGrid items={items} emptyLabel="No confirmed upcoming GL yet." />
    </div>
  );
}
