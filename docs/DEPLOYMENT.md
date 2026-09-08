# Deployment

Nothing described here has been deployed yet from this repository.
This is a guide for doing it, not a record that it happened.

## Recommended targets

| Piece | Where |
| --- | --- |
| Frontend (Next.js) | Vercel, or any Next.js compatible host |
| Auth, database, storage | Supabase (already required for local dev, same project) |
| Crawler worker | A container on Render, Railway, or Fly.io, a small VM, or a scheduled GitHub Action if the runtime limit is acceptable |
| Scheduling | Supabase Cron, calling a Supabase Edge Function |

## Frontend

1. Push this repository to your own remote if you have not already.
2. Import the project into Vercel (or your chosen host).
3. Set the environment variables from `.env.example` in the host's
   dashboard: `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `TMDB_API_KEY`, `CRAWLER_SECRET`, `SUPPORT_EMAIL`. Do not set
   `SUPABASE_SERVICE_ROLE_KEY` as a `NEXT_PUBLIC_*` variable; it must
   stay server only.
4. Deploy. `npm run build` runs as part of the standard Next.js build
   step.

## Crawler worker

The crawler is plain Python, not a serverless function, because
Playwright and multi source crawling do not fit comfortably inside a
short lived function.

1. Build a container from `crawler/` with `crawler/requirements.txt`
   installed, plus `playwright install --with-deps` if any adapter
   uses Playwright.
2. Expose a small HTTP endpoint (not included yet) that accepts a
   POST request authenticated with `CRAWLER_SECRET`, and runs
   `crawler.main.run_crawl(dry_run=False)` when called. This is the
   endpoint `app/api/admin/crawler/run` should notify.
3. Deploy that container to Render, Railway, Fly.io, or a VM you
   control, with `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   and `TMDB_API_KEY` set as environment variables there.
4. Confirm `python -m crawler.main --dry-run` succeeds against that
   deployment's environment before wiring the scheduler to it.

## Scheduling

1. `supabase functions deploy crawler-trigger` from a machine with the
   Supabase CLI logged in, after setting `APP_URL` and `CRAWLER_SECRET`
   as function secrets:
   ```bash
   supabase secrets set APP_URL=https://your-deployed-app.example CRAWLER_SECRET=your-shared-secret
   ```
2. Run `docs/SUPABASE_CRON.sql` in the Supabase SQL editor, replacing
   `<project-ref>` with your project's reference.
3. Confirm the schedule with:
   ```sql
   select * from cron.job;
   ```

## Definition of done before calling this live

- `npm run lint`, `npm run typecheck`, `npm run build`, and `npm test`
  all succeed.
- `python -m pytest tests/crawler` succeeds.
- `python -m crawler.main --dry-run` succeeds against the deployed
  worker's environment and the printed report looks correct for at
  least one real source, with selectors verified per
  `docs/CRAWLER.md`.
- An admin account exists and `/admin` is reachable only by it.
- The daily cron job appears in `cron.job` and has run at least once
  successfully.
