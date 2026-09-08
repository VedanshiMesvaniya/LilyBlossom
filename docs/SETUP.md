# Setup

This walks through going from this repository to a running local copy
of GL Tracker. Nothing here has been provisioned yet: you will create
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
   secret. Do not put it in any client side code or in
   `NEXT_PUBLIC_*` variables.
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
cp .env.example .env.local
```

Fill in:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the anon public key)
- `SUPABASE_SERVICE_ROLE_KEY` (server only, never exposed to the browser)
- `TMDB_API_KEY` (optional until you want poster or description enrichment)
- `CRAWLER_SECRET` (any long random string; shared between the Edge
  Function and the crawler trigger route)
- `DATABASE_URL` (Project Settings, Database, Connection string; used
  by the Python crawler if you choose to connect directly instead of
  through the Supabase client library)
- `SUPPORT_EMAIL` (defaults to support@gltracker.app)

## 4. Run the frontend

```bash
npm install
npm run dev
```

Visit http://localhost:3000. The home page, series, movies,
announcements, upcoming, and airing pages will load and simply show
empty states until the catalog has data in it, either from the
crawler or entered manually as an admin.

## 5. Make yourself an admin

After signing up once through the app, open the Supabase SQL editor
and run:

```sql
update profiles set role = 'admin' where id = 'your-user-id-here';
```

You can find your user id in Authentication, Users.

## 6. Run the crawler locally

```bash
cd crawler
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..
python -m crawler.main --dry-run
```

A dry run fetches, normalizes, and deduplicates, prints a report, and
writes nothing. Read [docs/CRAWLER.md](./CRAWLER.md) before running it
for real, since the source adapters' selectors need to be checked
against the live sites first.

## 7. Run the tests

```bash
npm run lint
npm run typecheck
npm test
python -m pytest tests/crawler
```

## 8. Schedule the daily crawl

Once the crawler is deployed somewhere with a stable URL (see
[docs/DEPLOYMENT.md](./DEPLOYMENT.md)), deploy the Edge Function and
register the cron job:

```bash
supabase functions deploy crawler-trigger
```

Then run `docs/SUPABASE_CRON.sql` in the SQL editor, filling in your
deployed function URL.
