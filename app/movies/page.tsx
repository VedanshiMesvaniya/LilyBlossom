import { MediaGrid } from "@/components/MediaGrid";
import { createClient } from "@/lib/supabase/server";
import { getTitlesByType } from "@/lib/catalog/queries";

export default async function MoviesPage({
  searchParams
}: {
  searchParams: { year?: string; country?: string; releaseStatus?: string };
}) {
  const supabase = createClient();
  const items = await getTitlesByType(supabase, "movie", searchParams);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-6 font-display text-3xl text-text-primary">Movies</h1>
      <MediaGrid items={items} emptyLabel="No GL movies match these filters yet." />
    </div>
  );
}
