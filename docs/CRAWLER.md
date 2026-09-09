# Crawler

The crawler is a separate Python worker under `crawler/`. It is never
run inside the browser. `crawler/main.py` holds the pipeline itself;
`crawler/worker.py` is the small HTTP backend that triggers it, see
ARCHITECTURE.md for how the two fit together.

## Pipeline

For every enabled row in the `sources` table's corresponding adapter:

```
fetch -> parse -> normalize -> validate -> deduplicate -> compare against
existing titles -> classify as new, duplicate, or uncertain -> store as
a crawl_item -> admin reviews -> publish
```

One broken source never stops the others. Each adapter's `run()`
method (in `crawler/sources/base.py`) catches its own errors and
returns them alongside whatever items it did manage to parse, so a
GLThai outage still lets GL Archive, GL Central, and ShipsBloom
complete.

## Adding a new source

1. Create `crawler/sources/your_source.py`, subclassing `SourceAdapter`
   from `crawler/sources/base.py`.
2. Implement `fetch()`, `parse()`, and `normalize()`. Each must return
   the types described in `crawler/sources/base.py`'s docstring.
3. Add a row to the `sources` table (through the admin UI or SQL) with
   `source_type = 'catalog'` and the real URL.
4. Register the class in `SOURCE_REGISTRY` inside `crawler/main.py`.

Nothing else in the pipeline needs to change. `main.py` does not know
or care how many sources exist.

## What is verified and what is not

The pipeline logic itself (`normalizer.py`, `deduplicator.py`,
`validator.py`, `change_detector.py`) is unit tested against realistic
sample data in `tests/crawler/` and passes.

The CSS selectors inside `crawler/sources/gl_archive.py`,
`gl_central.py`, `glthai.py`, and `shipsbloom.py` are a best effort
starting structure, written to the fetch, parse, normalize contract,
but not verified against the live sites' actual HTML. This was written
in an environment without network access to those domains. Before
running the crawler against production, for each adapter:

1. Fetch the real listing page and inspect its HTML structure.
2. Update the CSS selectors in `parse()` to match.
3. Confirm whether the page needs JavaScript rendering. If it does,
   replace the `httpx` based `fetch()` with a Playwright based one,
   the pattern is the same, only how the HTML is obtained changes.
4. Run `python -m crawler.main --dry-run` and read the printed report
   before ever running it for real.

Do not assume a source is working because the code runs without an
exception. Read the dry run's item count and confirm it looks right
for that source.

## Duplicate detection

`deduplicator.py` uses rapidfuzz token sort ratio on the normalized
title, with a penalty applied when the release year clearly differs.
Thresholds live in `crawler/config.py`:

- 0.95 and above: treated as the same title (`duplicate`)
- 0.80 to 0.95: queued for admin review (`uncertain`)
- below 0.80: treated as a different title (`new`)

Nothing is ever auto merged. The admin review queue is the only place
a duplicate is confirmed and merged.

## TMDB

`crawler/sources/tmdb.py` is an enrichment step, not a source adapter.
It never creates a new title on its own. Given a title a GL specific
adapter already found, it can fill in `poster_url` and `description`
through the official TMDB API. TMDB's attribution requirements apply
wherever TMDB sourced data or images are shown; add the required
attribution to an About or Credits page before enabling this in
production.

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
