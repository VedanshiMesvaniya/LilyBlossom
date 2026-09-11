import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MediaGrid } from "../components/MediaGrid.jsx";
import { Filters } from "../components/Filters.jsx";
import { Pagination } from "../components/Pagination.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { getTitlesByType, DEFAULT_PAGE_SIZE } from "../lib/catalogQueries.js";

const RELEASE_STATUS_OPTIONS = ["Announced", "In Production", "Upcoming", "Airing", "Completed", "Cancelled"];

export function MoviesListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const releaseStatus = searchParams.get("releaseStatus") ?? undefined;
  const sort = searchParams.get("sort") ?? "Newest";
  const page = Number(searchParams.get("page") ?? "1");

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    getTitlesByType(supabase, "movie", { releaseStatus, sort }, { page, pageSize: DEFAULT_PAGE_SIZE }).then(
      ({ data, count: total, error: queryError }) => {
        if (!isMounted) return;
        setItems(data);
        setCount(total);
        setError(queryError);
        setLoading(false);
      }
    );

    return () => {
      isMounted = false;
    };
  }, [releaseStatus, sort, page]);

  function updateFilters(next) {
    const params = {};
    if (next.releaseStatus) params.releaseStatus = next.releaseStatus;
    if (next.sort && next.sort !== "Newest") params.sort = next.sort;
    setSearchParams(params);
  }

  function goToPage(nextPage) {
    const params = Object.fromEntries(searchParams);
    params.page = String(nextPage);
    setSearchParams(params);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl text-text-primary">Movies</h1>
        <Filters value={{ releaseStatus, sort }} onChange={updateFilters} releaseStatusOptions={RELEASE_STATUS_OPTIONS} />
      </div>

      <MediaGrid
        items={items}
        loading={loading}
        error={error}
        emptyLabel="No GL movies match these filters yet."
      />

      {!loading && !error && (
        <Pagination page={page} pageSize={DEFAULT_PAGE_SIZE} count={count} onPageChange={goToPage} />
      )}
    </div>
  );
}
