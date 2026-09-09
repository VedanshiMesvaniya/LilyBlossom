import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MediaGrid } from "../components/MediaGrid.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { getTitlesByType } from "../lib/catalogQueries.js";

export function SeriesListPage() {
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState([]);

  useEffect(() => {
    const filters = {
      year: searchParams.get("year") ?? undefined,
      country: searchParams.get("country") ?? undefined,
      releaseStatus: searchParams.get("releaseStatus") ?? undefined
    };
    let isMounted = true;
    getTitlesByType(supabase, "series", filters).then((data) => {
      if (isMounted) setItems(data);
    });
    return () => {
      isMounted = false;
    };
  }, [searchParams]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-6 font-display text-3xl text-text-primary">Series</h1>
      <MediaGrid items={items} emptyLabel="No GL series match these filters yet." />
    </div>
  );
}
