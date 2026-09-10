# Architecture

## Why this shape

The previous prototype kept everything, including the catalog, in the
browser. That does not survive multiple users, a daily crawler, or an
admin review workflow. This version splits the system into pieces that
only talk to each other through the database or a small, narrow API:

```
                     LILYBLOSSOM
                          |
              React (Vite, plain JavaScript)
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
                Python backend (admin + crawler trigger only)
                          |
                  Python Crawler pipeline
                          |
                 Daily scheduled job
                          |
         -------------------------------
         |                |                |
      GL Archive        AniList          TMDB
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
                LilyBlossom users
```

Almost everything in that diagram is just "React talks to Supabase
directly." Browsing the catalog, signing in, and personal tracking
never touch a server of ours at all, they rely on Supabase's Row Level
Security (see `supabase/migrations/009_rls.sql`) as the real access
boundary. The one small Python backend (`crawler/worker.py`) exists
only for the handful of actions that need the service-role key, which
must never reach the browser: triggering a crawl, and the two admin
edit actions that write an audit log entry.

## One command starts everything

`npm run dev` uses `concurrently` to start the Vite dev server and the
Python backend side by side. There is no separate step to remember and
no second terminal to keep open for local development. See
`package.json` and `docs/SETUP.md`.

## Why the crawler is not inside the frontend or a Supabase Edge Function

The crawler needs a full Python environment, with room to add
Playwright later if a future source needs JavaScript rendering, plus
retry and backoff logic, and enough runtime to crawl several sources
without hitting a serverless function's time limit. Supabase Edge
Functions are a poor fit for that. Supabase is used for what it is
strong at: auth, PostgreSQL, storage, Row Level Security, and
scheduling.

The crawler runs as its own service (see `crawler/`) and is triggered
on a schedule by Supabase Cron through a small Edge Function
(`supabase/functions/crawler-trigger`), which calls the Python
backend's `/run` endpoint directly with a shared secret. See
[docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for where that backend
actually runs in production.

## Why a small Python backend instead of a Node one

The crawler pipeline was already Python. Rather than run a second
runtime just to hold a few admin endpoints, `crawler/worker.py` uses
Python's standard library HTTP server to expose the same three
endpoints a Node service would have needed. One runtime, one process,
one thing to deploy alongside the crawler.

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
row. `src/components/TrackingControls.jsx` writes to this table
directly from the browser using the signed-in user's own Supabase
session. Row Level Security restricts every row to its own owner (see
`supabase/migrations/009_rls.sql`), so this is safe without a backend
in the middle, even a bug in the frontend cannot expose or modify
another user's tracking data.

## What can change without breaking this shape

- Adding a new crawler source means adding one file under
  `crawler/sources/` and registering it in `crawler/main.py`'s
  `SOURCE_REGISTRY`. Nothing else in the pipeline needs to change.
- Adding a new catalog filter or sort option is a change to
  `src/lib/catalogQueries.js` and the relevant page, not to the schema.
- Swapping the backend's hosting target (Render, Railway, Fly.io, a
  VM) only changes `docs/DEPLOYMENT.md` and the URL the Edge Function
  and the frontend's `VITE_API_URL` point at. The backend code itself
  does not depend on where it runs.

## Update this file when architecture changes

If a future change adds, removes, or reroutes one of the main pieces
(frontend, Supabase, backend, crawler) or changes how they talk to
each other, this file and the diagram above should be updated in the
same change, not left to go stale.
