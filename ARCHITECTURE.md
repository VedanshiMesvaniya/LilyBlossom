# Architecture

## Why this shape

The previous prototype kept everything, including the catalog, in the
browser. That does not survive multiple users, a daily crawler, or an
admin review workflow, so this version splits the system into three
independent pieces that only talk to each other through the database
or a defined API:

```
                    GL TRACKER
                         |
                Next.js (App Router)
                         |
                    Supabase
          -------------------------------
          |              |              |
       Auth           PostgreSQL      Storage
          |              |              |
     email/password   GL catalog      posters
          |              |
          |         user tracking
          |              |
          -------------------------------
                         |
                  Python Crawler
                         |
                Daily scheduled job
                         |
        -------------------------------
        |                |                |
     GL Archive        GLThai         ShipsBloom
     GL Central
        |                |                |
        -------------------------------
                         |
                 normalize + dedupe
                         |
                  change detection
                         |
                  admin review queue
                         |
                     publish
                         |
                  GL Tracker users
```

## Why the crawler is not inside Next.js or a Supabase Edge Function

The crawler needs a full Python environment with Playwright for
JavaScript rendered pages, retry and backoff logic, and enough runtime
to crawl several sources without hitting a serverless function's time
limit. Supabase Edge Functions and Vercel functions are both a poor
fit for that. Supabase is used for what it is strong at: auth,
PostgreSQL, storage, Row Level Security, and scheduling.

The crawler runs as its own service (see `crawler/`) and is triggered
on a schedule by Supabase Cron through a small Edge Function
(`supabase/functions/crawler-trigger`), which calls a secured route in
the Next.js app (`app/api/admin/crawler/run`), which in turn is
expected to notify the deployed Python worker. See
[docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for where that worker
actually runs.

## Data flow for a new title

1. A source adapter in `crawler/sources/` fetches a listing page from
   one allow listed source.
2. `normalizer.py` cleans the title text so different casing,
   punctuation, or hyphenation do not look like different titles.
3. `deduplicator.py` fuzzy matches the normalized title against titles
   already in the database using rapidfuzz.
4. Based on the match score, the item is classified as `new`,
   `duplicate`, or `uncertain` and written to `crawl_items` alongside
   the run it came from.
5. An admin opens `/admin/review`, sees the new or uncertain items, and
   publishes, rejects, merges, or corrects them.
6. Only after an admin action does a title become visible to normal
   users. Nothing the crawler finds is public by default.

## Data flow for personal tracking

A signed in user's watch status is stored in `user_media_status`, keyed
by `(user_id, title_id)`, and is never written to the shared `titles`
row. The API route `app/api/me/list/[titleId]/route.ts` is the only
write path for this table, and Row Level Security additionally
restricts every row to its own owner, so even a bug in that route
cannot expose or modify another user's tracking data.

## What can change without breaking this shape

- Adding a new crawler source means adding one file under
  `crawler/sources/` and registering it in `crawler/main.py`'s
  `SOURCE_REGISTRY`. Nothing else in the pipeline needs to change.
- Adding a new catalog filter or sort option is a change to
  `lib/catalog/queries.ts` and the relevant page, not to the schema.
- Swapping the crawler's hosting target (Render, Railway, Fly.io, a
  VM, or a scheduled GitHub Action) only changes
  `docs/DEPLOYMENT.md` and the URL the Edge Function calls. The
  crawler code itself does not depend on where it runs.

## Update this file when architecture changes

If a future change adds, removes, or reroutes one of the three main
pieces (frontend, Supabase, crawler) or changes how they talk to each
other, this file and the diagram above should be updated in the same
change, not left to go stale.
