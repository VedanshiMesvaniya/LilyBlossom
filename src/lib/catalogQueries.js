// Read-only catalog queries shared by the public pages.
// Every query filters to is_published = true: unpublished crawler
// records are only visible through the admin review queue (which
// reads directly, since Row Level Security already lets an admin see
// unpublished rows, see supabase/migrations/009_rls.sql).

const CARD_COLUMNS = "slug, type, canonical_title, release_year, country, poster_url, release_status";

function toCardData(row) {
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

export async function getHomeSections(supabase) {
  const base = () =>
    supabase.from("titles").select(CARD_COLUMNS).eq("is_published", true);

  const [airing, upcoming, recentlyAdded] = await Promise.all([
    base().eq("release_status", "Airing").limit(10),
    base().in("release_status", ["Upcoming", "Announced"]).order("release_date", { ascending: true }).limit(10),
    supabase
      .from("titles")
      .select(CARD_COLUMNS)
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

export async function getTitlesByType(supabase, type, filters = {}) {
  let query = supabase
    .from("titles")
    .select(CARD_COLUMNS)
    .eq("is_published", true)
    .eq("type", type);

  if (filters.year) query = query.eq("release_year", Number(filters.year));
  if (filters.country) query = query.eq("country", filters.country);
  if (filters.releaseStatus) query = query.eq("release_status", filters.releaseStatus);

  const { data } = await query.order("release_year", { ascending: false });
  return (data ?? []).map(toCardData);
}

export async function getTitleBySlug(supabase, slug) {
  const { data } = await supabase
    .from("titles")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .single();
  return data;
}

export async function getAiring(supabase) {
  const { data } = await supabase
    .from("titles")
    .select(CARD_COLUMNS)
    .eq("is_published", true)
    .eq("release_status", "Airing")
    .order("release_year", { ascending: false });
  return (data ?? []).map(toCardData);
}

export async function getUpcoming(supabase) {
  const { data } = await supabase
    .from("titles")
    .select(`${CARD_COLUMNS}, release_date`)
    .eq("is_published", true)
    .in("release_status", ["Announced", "In Production", "Upcoming"])
    .order("release_date", { ascending: true });
  return (data ?? []).map(toCardData);
}

export async function getPublishedAnnouncements(supabase) {
  const { data } = await supabase
    .from("announcements")
    .select("slug, title, summary, cover_image, published_at, announcement_type")
    .eq("status", "published")
    .order("published_at", { ascending: false });
  return data ?? [];
}

export async function getAnnouncementBySlug(supabase, slug) {
  const { data } = await supabase
    .from("announcements")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .single();
  return data;
}
