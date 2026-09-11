-- crawl_runs previously only stored aggregate counts (sources_checked,
-- items_found, ...), so the admin crawler page could never show a real
-- per-source breakdown ("GL Archive: OK, 4215 items / AniList:
-- unavailable"), only a single number for the whole run. This column
-- holds that breakdown as a small JSON array, written once per run by
-- crawler/main.py's run_crawl().
--
-- Shape: [{"name": "GL Archive", "status": "OK", "items_found": 4215}, ...]
alter table crawl_runs add column if not exists source_results jsonb;
