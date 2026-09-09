import { useEffect, useState } from "react";
import { MediaGrid } from "../components/MediaGrid.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { getAiring } from "../lib/catalogQueries.js";

export function AiringPage() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    let isMounted = true;
    getAiring(supabase).then((data) => {
      if (isMounted) setItems(data);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-6 font-display text-3xl text-text-primary">Currently Airing</h1>
      <MediaGrid items={items} emptyLabel="Nothing airing right now." />
    </div>
  );
}
