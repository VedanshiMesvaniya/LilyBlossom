import { useEffect, useState } from "react";
import { MediaGrid } from "../components/MediaGrid.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { getUpcoming } from "../lib/catalogQueries.js";

export function UpcomingPage() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    let isMounted = true;
    getUpcoming(supabase).then((data) => {
      if (isMounted) setItems(data);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-6 font-display text-3xl text-text-primary">Upcoming GL</h1>
      <MediaGrid items={items} emptyLabel="No confirmed upcoming GL yet." />
    </div>
  );
}
