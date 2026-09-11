# Crawler

The crawler is a separate Python worker under `crawler/`. It is never
run inside the browser. `crawler/main.py` holds the pipeline itself;
`crawler/worker.py` is the small HTTP backend that triggers it, see
ARCHITECTURE.md for how the two fit together.

## Pipeline

For every enabled row in the `sources` table's corresponding adapter
(`crawler/main.py`'s `load_enabled_sources()`; this is what
Admin -> Sources actually controls):

```
fetch -> parse -> normalize -> validate -> deduplicate -> compare against
existing titles ->
  no match           -> insert a new (unpublished) titles row
  confident match     -> update the titles row if anything changed,
                          unless it is locked
  unclear match        -> leave as `uncertain` in crawl_items for review
-> link title_sources -> store as a crawl_item, tagged with the run
   that found it -> admin publishes (or corrects) when ready
```

A crawler-created title is always written with `is_published = false`.
Nothing it finds is public until an admin publishes it, see
`docs/ADMIN.md`. The only case still fully gated behind admin review
before it touches `titles` at all is a genuinely unclear match.

One broken source never stops the others. Each adapter's `run()`
method (in `crawler/sources/base.py`) catches its own errors and
returns them alongside whatever items it did manage to parse, so an
AniList outage (for example a temporary 403 or rate limit) still lets
GL Archive and TMDB complete. The crawl report at the end of a run
lists each source as `OK`, `OK, N record(s) skipped`, or `unavailable
(reason)`, so a dead or rate-limited source is easy to spot without
reading every error line.

## Adding a new source

1. Create `crawler/sources/your_source.py`, subclassing `SourceAdapter`
   from `crawler/sources/base.py`.
2. Implement `fetch()`, `parse()`, and `normalize()`. Each must return
   the types described in `crawler/sources/base.py`'s docstring.
3. Register the class in `SOURCE_REGISTRY` inside `crawler/main.py`.
   This is only the fallback list used when the `sources` table has no
   rows at all (a fresh database).
4. Add a row to the `sources` table (through the admin UI or SQL) with
   `source_type = 'catalog'`, the real URL, and a `name` that matches
   the adapter class's `name` attribute exactly. This is the row that
   actually turns the adapter on: `load_enabled_sources()` in
   `crawler/main.py` only runs adapters with a matching, `enabled`
   `sources` row (see `supabase/migrations/012_seed_sources.sql` for
   the three current sources).

Nothing else in the pipeline needs to change. `main.py` does not know
or care how many sources exist.

## What is verified and what is not

The pipeline logic itself (`normalizer.py`, `deduplicator.py`,
`validator.py`, `change_detector.py`) is unit tested against realistic
sample data in `tests/crawler/` and passes.

The three current sources are verified differently:

- `crawler/sources/gl_archive.py` scrapes `glarchive.net`'s live
  catalog page with CSS selectors. Its selectors were checked against
  that site's real markup, but any GL Archive page redesign can break
  them silently, so re-check them if the crawl report shows an
  unexpected drop in items from this source.
- `crawler/sources/anilist.py` and `crawler/sources/tmdb.py` use
  official, documented JSON APIs (AniList's GraphQL API and the TMDB
  REST API), not scraping. There is no markup to keep in sync, but
  both are still external services: AniList in particular can return
  a temporary error or apply a rate limit, which the crawler reports
  as that source being `unavailable` for the run rather than failing
  the whole crawl (see `crawler/sources/base.py`).

Before running the crawler against production:

1. Run `python -m crawler.main --dry-run` and read the printed report.
2. If GL Archive's item count looks low or zero, fetch the live
   catalog page and check whether its HTML structure changed, then
   update the selectors in `gl_archive.py`'s `parse()`.
3. Confirm `TMDB_API_KEY` is set if you want TMDB results; without it,
   `crawler/sources/tmdb.py` returns no items rather than raising.

Do not assume a source is working because the code runs without an
exception. Read the dry run's item count and confirm it looks right
for that source.

## Duplicate detection

`deduplicator.py` checks two signals, in order:

1. A shared external ID. If the incoming item's `tmdb_id`,
   `anilist_id`, or `imdb_id` matches an existing title's, it is
   treated as the same title immediately, since a shared ID is a much
   stronger signal than similar text and survives a retitled or
   retranslated release.
2. If no external ID matches (or the source does not provide one, like
   GL Archive), it falls back to rapidfuzz token sort ratio on the
   normalized title, with a penalty applied when the release year
   clearly differs. Thresholds live in `crawler/config.py`:
   - 0.95 and above: treated as the same title (`duplicate`)
   - 0.80 to 0.95: queued for admin review (`uncertain`)
   - below 0.80: treated as a different title (`new`)

A confident match (0.95+, or a shared external ID) updates the
existing title's metadata directly if anything actually changed; it
does not create a second row for the same title. Nothing is ever auto
merged across two different existing title rows; that, and resolving
the 0.80-0.95 "uncertain" band, is still what the admin review queue
is for.

## AniList

`crawler/sources/anilist.py` is a source adapter, registered in
`SOURCE_REGISTRY`. It queries AniList's public GraphQL API for anime
tagged `Yuri` and can create new titles on its own, the same as GL
Archive. It needs no API key. AniList's API can be temporarily
unavailable or rate limited; when that happens the crawler reports
this source as `unavailable` for that run and continues with the
other sources.

## TMDB

`crawler/sources/tmdb.py` has two roles:

- `TMDBAdapter` is a source adapter, registered in `SOURCE_REGISTRY`.
  It discovers GL live-action titles through TMDB's `/discover/tv` and
  `/discover/movie` endpoints filtered to GL specific keyword IDs
  (lesbian romance, yuri, girls' love, GL), so it does not pull in
  TMDB's general catalog. It pages through up to `MAX_TMDB_PAGES`
  pages per endpoint (`crawler/config.py`, default 5), stopping early
  once TMDB reports there are no more pages, rather than only ever
  reading page 1. The current `GL_KEYWORD_IDS` have not been verified
  against a live TMDB account; confirm they map to the intended GL/
  Yuri classifications before relying on TMDB result counts.
- `TMDBEnricher` is a separate, optional enrichment step. Given a
  title a different adapter already found, it can fill in `poster_url`
  and `description` through TMDB's search endpoint. It never creates a
  new title on its own.

Both require `TMDB_API_KEY`; without it, `TMDBAdapter.fetch()` returns
no items rather than raising, and `TMDBEnricher` is simply not used.
TMDB's attribution requirements apply wherever TMDB sourced data or
images are shown; add the required attribution to an About or Credits
page before enabling this in production.

## Scheduling

Supabase Cron calls `supabase/functions/crawler-trigger` daily, which
calls the Python backend's `/run` endpoint (`crawler/worker.py`)
directly with the shared `CRAWLER_SECRET`. See
`docs/SUPABASE_CRON.sql` for the exact schedule, and
`docs/DEPLOYMENT.md` for where that backend needs to run.

## Never hard code the current year

`crawler/config.py` derives `CURRENT_YEAR` from the system clock. Do
not replace this with a literal year anywhere in the crawler or the
frontend; upcoming titles need to keep classifying correctly every
year without a code change.
