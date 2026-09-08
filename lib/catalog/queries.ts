// Read-only catalog queries shared by the public pages.
// Every query filters to is_published = true: unpublished crawler
// records are only visible through the admin review queue.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MediaCardData } from "@/components/MediaCard";

type TitleRow = {
  slug: string;
  type: "series" | "movie";
  canonical_title: string;
  release_year: number | null;
  country: string | null;
  poster_url: string | null;
  release_status: string;
};

function toCardData(row: TitleRow): MediaCardData {
  return {
    slug: row.slug,
    type: row.type,
    title: row.canonical_title,
    year: row.release_year,
    country: row.country,
    posterUrl: row.poster_url,
    releaseStatus: row.release_status
  };
}

export async function getHomeSections(supabase: SupabaseClient) {
  const base = supabase
    .from("titles")
    .select("slug, type, canonical_title, release_year, country, poster_url, release_status")
    .eq("is_published", true);

  const [airing, upcoming, recentlyAdded] = await Promise.all([
    base.eq("release_status", "Airing").limit(10),
    base.in("release_status", ["Upcoming", "Announced"]).order("release_date", { ascending: true }).limit(10),
    supabase
      .from("titles")
      .select("slug, type, canonical_title, release_year, country, poster_url, release_status")
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .limit(10)
  ]);

  return {
    airing: (airing.data ?? []).map(toCardData),
    upcoming: (upcoming.data ?? []).map(toCardData),
    recentlyAdded: (recentlyAdded.data ?? []).map(toCardData)
  };
}

export async function getTitlesByType(
  supabase: SupabaseClient,
  type: "series" | "movie",
  filters: { year?: string; country?: string; releaseStatus?: string } = {}
) {
  let query = supabase
    .from("titles")
    .select("slug, type, canonical_title, release_year, country, poster_url, release_status")
    .eq("is_published", true)
    .eq("type", type);

  if (filters.year) query = query.eq("release_year", Number(filters.year));
  if (filters.country) query = query.eq("country", filters.country);
  if (filters.releaseStatus) query = query.eq("release_status", filters.releaseStatus);

  const { data } = await query.order("release_year", { ascending: false });
  return (data ?? []).map(toCardData);
}

export async function getTitleBySlug(supabase: SupabaseClient, slug: string) {
  const { data } = await supabase
    .from("titles")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .single();
  return data;
}
