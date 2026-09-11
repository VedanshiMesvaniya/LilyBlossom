import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MediaGrid } from "../components/MediaGrid.jsx";
import { Pagination } from "../components/Pagination.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { searchTitles, DEFAULT_PAGE_SIZE } from "../lib/catalogQueries.js";

const TYPE_TABS = [
  { key: undefined, label: "All" },
  { key: "series", label: "Series" },
  { key: "movie", label: "Movies" }
];

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const type = searchParams.get("type") || undefined;
  const page = Number(searchParams.get("page") ?? "1");

  const [inputValue, setInputValue] = useState(query);
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setInputValue(query);
  }, [query]);

  useEffect(() => {
    if (!query.trim()) {
      setItems([]);
      setCount(0);
      setLoading(false);
      setError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    searchTitles(supabase, query, { type, page, pageSize: DEFAULT_PAGE_SIZE }).then(
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
  }, [query, type, page]);

  function submitSearch(event) {
    event.preventDefault();
    setSearchParams(inputValue.trim() ? { q: inputValue.trim(), ...(type ? { type } : {}) } : {});
  }

  function changeType(nextType) {
    const params = { q: query };
    if (nextType) params.type = nextType;
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
      <h1 className="mb-6 font-display text-3xl text-text-primary">Search</h1>

      <form onSubmit={submitSearch} className="mb-6 flex gap-2">
        <input
          type="search"
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          placeholder="Search GL titles..."
          className="w-full rounded-full border border-border bg-surface px-4 py-2 font-ui text-sm text-text-primary focus:border-primary focus:outline-none"
        />
        <button
          type="submit"
          className="shrink-0 rounded-full bg-primary px-5 py-2 font-ui text-sm text-white hover:bg-primary-hover"
        >
          Search
        </button>
      </form>

      {query.trim() && (
        <div className="mb-4 flex gap-2 font-ui text-sm">
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.label}
              type="button"
              onClick={() => changeType(tab.key)}
              className={`rounded-full border px-3 py-1.5 ${
                type === tab.key
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-surface text-text-primary hover:border-primary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {!query.trim() ? (
        <p className="py-12 text-center font-ui text-text-muted">Type something to search the catalog.</p>
      ) : (
        <>
          <MediaGrid
            items={items}
            loading={loading}
            error={error}
            emptyLabel={`No published titles match "${query}".`}
          />
          {!loading && !error && (
            <Pagination page={page} pageSize={DEFAULT_PAGE_SIZE} count={count} onPageChange={goToPage} />
          )}
        </>
      )}
    </div>
  );
}
