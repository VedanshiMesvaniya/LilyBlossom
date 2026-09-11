import { useEffect, useState } from "react";
import { MediaGrid } from "../components/MediaGrid.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { getUpcoming } from "../lib/catalogQueries.js";

export function UpcomingPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    getUpcoming(supabase).then(({ data, error: queryError }) => {
      if (!isMounted) return;
      setItems(data);
      setError(queryError);
      setLoading(false);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-6 font-display text-3xl text-text-primary">Upcoming GL</h1>
      <MediaGrid items={items} loading={loading} error={error} emptyLabel="No confirmed upcoming GL yet." />
    </div>
  );
}
