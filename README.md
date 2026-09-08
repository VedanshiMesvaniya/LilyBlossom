# GL Tracker

GL Tracker is a dedicated media catalog and personal watch tracker for
Girls' Love (GL / yuri / sapphic) movies and series. It is built for
real, multi-user use: real authentication, a real centralized catalog,
a daily automated crawler, an admin review workflow, and personal
tracking per user.

This is not a demo. There is no local storage catalog, no browser side
scraping, and no user submitted catalog entries. The catalog is only
ever written by the crawler pipeline or an admin.

## What this app does

- Lets people create an account with email and password and get a
  unique, auto generated GL themed username.
- Lets people browse a curated catalog of GL series and movies,
  separately, with search, filters and sorting.
- Lets each signed in person track their own status per title: Plan to
  Watch, Watching, Watched, or Dropped, plus episode or movie progress.
- Publishes GL specific announcements: new releases, release dates,
  trailers, casting news, and status changes.
- Runs a daily crawler across a fixed, explicit list of trusted GL
  sources, detects new titles and metadata changes, and queues them
  for admin review before anything goes public.
- Gives an admin a dashboard to review new titles, review metadata
  changes, merge duplicates, manage sources, and publish or unpublish
  announcements.

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS |
| Auth, database, storage | Supabase (Auth, PostgreSQL, Storage, Row Level Security, Cron) |
| Crawler | Python, httpx, BeautifulSoup, Playwright (for JS rendered pages), Pydantic, rapidfuzz |
| Scheduling | Supabase Cron (pg_cron) calling a Supabase Edge Function, which triggers the crawler worker |

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full picture of how
these pieces fit together and why the crawler is a separate Python
worker instead of code inside the frontend.

## Project status

This repository currently holds a complete, working scaffold of the
architecture described above:

- All pages and API routes described in the product spec exist and
  are wired to Supabase queries that respect Row Level Security.
- All database tables and RLS policies are written as SQL migrations
  and are ready to run against a Supabase project.
- The crawler pipeline (fetch, parse, normalize, validate, deduplicate,
  change detect) is implemented and unit tested against realistic
  sample data.
- The specific CSS selectors inside each site adapter
  (`crawler/sources/*.py`) are a best effort starting point. They have
  not been verified against the live GL Archive, GL Central, GLThai or
  ShipsBloom pages, because this build environment cannot reach those
  domains. Read `docs/CRAWLER.md` before running the crawler for real,
  and expect to adjust selectors against the actual site markup.
- No Supabase project, TMDB key, or hosting has been provisioned yet.
  Nothing has been deployed. `docs/SETUP.md` walks through provisioning
  everything from scratch.

## Getting started

See [docs/SETUP.md](./docs/SETUP.md) for full setup steps. Short version:

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project values
npm run dev
```

For the crawler:

```bash
cd crawler
pip install -r requirements.txt
python -m crawler.main --dry-run
```

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md): system overview and why each
  piece exists.
- [docs/SETUP.md](./docs/SETUP.md): environment, Supabase, and local
  dev setup.
- [docs/DATABASE.md](./docs/DATABASE.md): schema, RLS rules, and the
  personal tracking versus global catalog separation.
- [docs/CRAWLER.md](./docs/CRAWLER.md): how the daily crawler works,
  how to add a new source, and what still needs verification.
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md): deploying the frontend,
  database, and crawler worker.
- [docs/ADMIN.md](./docs/ADMIN.md): the admin review and moderation
  workflow.

## Support

support@gltracker.app

## Copyright

Copyright the current year, Vedu, GL Tracker.

Original GL Tracker UI, software and tracking experience. Third party
titles, trademarks, posters, logos and source material remain the
property of their respective rights holders.
