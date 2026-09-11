# LilyBlossom

LilyBlossom is a dedicated media catalog and personal watch tracker
for Girls' Love (GL / yuri / sapphic) movies and series. It is built
for real, multi-user use: real authentication, a real centralized
catalog, a daily automated crawler, an admin review workflow, and
personal tracking per user.

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
| Frontend | React (plain JavaScript, no TypeScript), Vite, react-router-dom, Tailwind CSS |
| Backend | FastAPI + Uvicorn, for admin actions and the crawler trigger only |
| Auth, database, storage | Supabase (Auth, PostgreSQL, Storage, Row Level Security, Cron) |
| Crawler | Python, httpx, BeautifulSoup, Pydantic, rapidfuzz |
| Scheduling | Supabase Cron (pg_cron) calling a Supabase Edge Function, which calls the backend |

Almost everything talks to Supabase directly from the browser and
relies on Row Level Security, there is no framework server in between
anymore. The Python backend exists only for the handful of actions
that need a secret key. See [ARCHITECTURE.md](./ARCHITECTURE.md) for
the full picture.

## Project status

This repository currently holds a complete, working scaffold of the
architecture described above:

- All pages exist and talk to Supabase directly, respecting Row Level
  Security.
- All database tables and RLS policies are written as SQL migrations
  and are ready to run against a Supabase project.
- The crawler pipeline (fetch, parse, normalize, validate, deduplicate,
  change detect, and write) is implemented and unit tested against
  realistic sample data. A confidently matched or brand new item now
  writes straight to the `titles` table (unpublished, so it is never
  public by itself); only a genuinely uncertain match still waits in
  the review queue. See docs/CRAWLER.md.
- The backend (`crawler/worker.py`) is FastAPI on Uvicorn. One crawl is
  one `crawl_runs` row from `queued` through to a final status, the
  admin crawler page can poll `GET /runs/{id}` for live progress, and
  a second crawl cannot be started while one is already in progress.
- The admin area works end to end: `/admin/crawler` polls a run live
  and shows a per-source breakdown, `/admin/sources` can actually
  enable/disable a source and change its priority, and
  `/admin/review` can publish, reject, or merge a review queue item,
  all logged to `admin_actions`. See docs/ADMIN.md.
- Catalog pages show real loading and error states instead of a blank
  screen or a silently empty list, and Series, Movies, and
  Announcements are paginated rather than loading the whole catalog at
  once. There is a working search box (`/search`) across canonical and
  original titles.
- Personal tracking covers the full schema, not just watch status:
  favoriting a title, setting watch progress (which auto-completes a
  title at 100%, see `supabase/migrations/003_user_tracking.sql`), and
  a `/profile` edit form for username, bio, favorite GL, and favorite
  pairing, all previously present in the database but not reachable
  from any page.
- The crawler's three sources are GL Archive, AniList, and TMDB:
  - GL Archive (`crawler/sources/gl_archive.py`) scrapes the live
    catalog page directly. Its CSS selectors were checked against
    that site's real markup.
  - AniList and TMDB (`crawler/sources/anilist.py`,
    `crawler/sources/tmdb.py`) use official, documented JSON APIs, not
    scraping, so there is no markup to keep in sync. AniList can
    return a temporary error or get rate limited; the crawler treats
    that as one source being unavailable for that run rather than a
    reason to fail the whole crawl, see `docs/CRAWLER.md`.
- A `Dockerfile` builds the backend as described in
  `docs/DEPLOYMENT.md`. The frontend is a static build deployed
  separately; it has no Dockerfile of its own.
- `npm audit` reports a moderate/high react-router advisory
  (`GHSA-wrjc-x8rr-h8h6`, an open redirect via a backslash in
  `<Link>`/`useNavigate`) that a major version bump would fix. Rather
  than take that breaking change untested, `LoginPage.jsx`'s `?next=`
  redirect target is validated directly
  (`src/lib/sanitizeNextPath.js`), which closes the actual exploitable
  path in this app regardless of the installed react-router version.
  The remaining `npm audit` findings are dev-server-only (esbuild,
  vitest's mocker) and do not affect the built frontend.
- No Supabase project, TMDB key, or hosting has been provisioned yet.
  Nothing has been deployed. `docs/SETUP.md` walks through provisioning
  everything from scratch.

## Getting started

See [docs/SETUP.md](./docs/SETUP.md) for full setup steps. Short version:

```bash
npm install
pip install -r crawler/requirements.txt
cp .env.example .env   # fill in your Supabase project values
npm run dev
```

`npm run dev` starts the whole app, the React frontend and the FastAPI
backend, with one command. There is nothing else to run separately for
local development.

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
  database, and backend.
- [docs/ADMIN.md](./docs/ADMIN.md): the admin review and moderation
  workflow.
- [LICENSE](./LICENSE): the MIT license covering this project's own
  code.
- [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md): every third-party
  resource this project uses and the conditions attached to it.

## Support

vedanshimesvaniya@gmail.com

## License

This project's own code is MIT licensed, copyright Vedanshi Mesvaniya,
see [LICENSE](./LICENSE). This project also uses third-party resources
such as open source packages, fonts, the TMDB API, and titles,
descriptions, posters and other metadata sourced from third-party GL
catalog sites. Those stay under their own licenses and terms, see
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) for the full list
and conditions.
