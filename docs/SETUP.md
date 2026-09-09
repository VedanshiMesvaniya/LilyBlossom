# Setup

This walks through going from this repository to a running local copy
of LilyBlossom. Nothing here has been provisioned yet: you will create
your own Supabase project, your own TMDB key, and your own secrets.

## 1. Prerequisites

- Node.js 20 or newer
- Python 3.11 or newer
- A Supabase account (the free tier is enough to start)
- Optional for now, needed before enabling poster enrichment: a TMDB
  API key from https://www.themoviedb.org/settings/api

## 2. Create the Supabase project

1. Create a new project at https://supabase.com/dashboard.
2. In Project Settings, API, copy the Project URL and the anon public
   key, and separately the service role key. The service role key is
   secret. Do not put it in any client side code or in any `VITE_*`
   variable, Vite exposes every `VITE_` prefixed variable to the
   browser bundle.
3. In the SQL editor, run every file in `supabase/migrations/` in
   order, `001` through `009`. Each file is idempotent where practical,
   but running them out of order will fail on missing tables.
4. Create three storage buckets: `title-posters`, `title-backdrops`,
   and `avatars`, plus `announcement-images`. Mark them public if you
   want images to load without a signed URL, and rely on the RLS
   policies in `009_rls.sql` to control who can write to the
   underlying tables that reference them.
5. In Authentication, Providers, confirm Email is enabled. Email
   confirmations can stay on.

## 3. Configure environment variables

```bash
cp .env.example .env
```

This one file is read by both the React frontend and the Python
backend, see the comments inside it. Fill in:

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (the anon
  public key), used by both sides.
- `SUPABASE_SERVICE_ROLE_KEY` (backend only, never exposed to the
  browser).
- `TMDB_API_KEY` (optional until you want poster or description
  enrichment).
- `CRAWLER_SECRET` (any long random string; shared between the Edge
  Function and the backend's `/run` endpoint).
- `DATABASE_URL` (Project Settings, Database, Connection string; used
  by the Python crawler if you choose to connect directly instead of
  through the Supabase client library).
- `VITE_API_URL` and `CRAWLER_WORKER_PORT` (defaults already fill in
  `http://localhost:8787` and `8787`, only change these if that port
  is taken).
- `VITE_SUPPORT_EMAIL` (defaults to vedanshimesvaniya@gmail.com).

## 4. Install dependencies

```bash
npm install
pip install -r crawler/requirements.txt
```

A Python virtual environment is optional but recommended:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r crawler/requirements.txt
```

## 5. Run the whole app with one command

```bash
npm run dev
```

This starts the React frontend (Vite) and the small Python backend
(`crawler/worker.py`) together. Visit http://localhost:5173. The home
page, series, movies, announcements, upcoming, and airing pages will
load and simply show empty states until the catalog has data in it,
either from the crawler or entered manually as an admin.

If you only want one side running, `npm run dev:web` starts just the
frontend and `npm run dev:api` starts just the backend.

## 6. Make yourself an admin

After signing up once through the app, open the Supabase SQL editor
and run:

```sql
update profiles set role = 'admin' where id = 'your-user-id-here';
```

You can find your user id in Authentication, Users.

## 7. Run the crawler by hand

```bash
python -m crawler.main --dry-run
```

A dry run fetches, normalizes, and deduplicates, prints a report, and
writes nothing. Read [docs/CRAWLER.md](./CRAWLER.md) before running it
for real, since the source adapters' selectors need to be checked
against the live sites first. To trigger a real crawl the way the
admin dashboard's "Run Crawl Now" button does, use
`npm run dev` and click that button on `/admin/crawler`, or `curl` the
backend directly:

```bash
curl -X POST http://localhost:8787/run -H "x-crawler-secret: <your CRAWLER_SECRET>"
```

## 8. Run the tests

```bash
npm run lint
npm test
python -m pytest tests/crawler
```

## 9. Schedule the daily crawl

Once the backend is deployed somewhere with a stable URL (see
[docs/DEPLOYMENT.md](./DEPLOYMENT.md)), deploy the Edge Function and
register the cron job:

```bash
supabase functions deploy crawler-trigger
```

Then run `docs/SUPABASE_CRON.sql` in the SQL editor, filling in your
deployed function URL.
