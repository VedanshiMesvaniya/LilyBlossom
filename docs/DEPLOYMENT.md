# Deployment

Nothing described here has been deployed yet from this repository.
This is a guide for doing it, not a record that it happened.

## Recommended targets

| Piece | Where |
| --- | --- |
| Frontend (React, static build) | Vercel, Netlify, Cloudflare Pages, or any static host |
| Auth, database, storage | Supabase (already required for local dev, same project) |
| Backend (admin actions + crawler trigger) | A container on Render, Railway, or Fly.io, or a small VM |
| Scheduling | Supabase Cron, calling a Supabase Edge Function |

## Frontend

The frontend is a plain static site once built, `npm run build` writes
static HTML, CSS, and JS to `dist/`. There is no server-side rendering
step to run.

1. Push this repository to your own remote if you have not already.
2. Import the project into Vercel, Netlify, or your chosen static
   host, with `npm run build` as the build command and `dist` as the
   output directory.
3. Set the environment variables from `.env.example` that start with
   `VITE_` in the host's dashboard: `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_API_URL` (point this at your
   deployed backend's URL), and `VITE_SUPPORT_EMAIL`. Do not set
   `SUPABASE_SERVICE_ROLE_KEY` here, it must never reach a `VITE_*`
   variable or the browser bundle.
4. Since this is a single-page app using client-side routing
   (react-router-dom), configure the host to serve `index.html` for
   every path that is not a real static file (a SPA rewrite rule).
   Vercel and Netlify both support this out of the box for a Vite
   build; check your host's docs if you use something else.

## Backend

The backend (`crawler/worker.py`) is a FastAPI app on Uvicorn, and
doubles as the crawler runner, so it is plain Python, not a serverless
function, since multi-source crawling, retries, and (if a future
adapter needs it) Playwright do not fit comfortably inside a short
lived function.

1. Build a container from the repository root with
   `crawler/requirements.txt` installed (this now includes `fastapi`
   and `uvicorn`), plus `playwright install --with-deps` only if a
   future adapter adds Playwright as a dependency. No current adapter
   uses it.
2. Run it with `uvicorn crawler.worker:app --host 0.0.0.0 --port $PORT`.
   **Always use a single worker** (the default; do not pass
   `--workers` with a value greater than 1). The crawl-in-progress lock
   in `POST /run` and the background crawl task both only work within
   one process; more than one worker process could start overlapping
   crawls against the same database. It listens on `CRAWLER_WORKER_PORT`
   (or `$PORT`, default `8787`) and exposes `/health`, `/run`,
   `/runs/{run_id}`, `/titles`, and `/announcements`, see
   `crawler/worker.py`'s module docstring for what each does.
3. Deploy that container to Render, Railway, Fly.io, or a VM you
   control, with `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `CRAWLER_SECRET`, and `TMDB_API_KEY` set as environment variables
   there. Also set `ENVIRONMENT=production` and `FRONTEND_ORIGIN` to
   your deployed frontend's exact URL: the backend refuses to start
   with `ENVIRONMENT=production` and no real `FRONTEND_ORIGIN`, since
   the default of `*` is only meant for local development.
4. Confirm `python -m crawler.main --dry-run` succeeds against that
   deployment's environment before wiring the scheduler to it.

## Scheduling

1. `supabase functions deploy crawler-trigger` from a machine with the
   Supabase CLI logged in, after setting `BACKEND_URL` and
   `CRAWLER_SECRET` as function secrets:
   ```bash
   supabase secrets set BACKEND_URL=https://your-deployed-backend.example CRAWLER_SECRET=your-shared-secret
   ```
2. Run `docs/SUPABASE_CRON.sql` in the Supabase SQL editor, replacing
   `<project-ref>` with your project's reference.
3. Confirm the schedule with:
   ```sql
   select * from cron.job;
   ```

## Definition of done before calling this live

- `npm run lint`, `npm run build`, and `npm test` all succeed.
- `python -m pytest tests/crawler` succeeds.
- `python -m crawler.main --dry-run` succeeds against the deployed
  backend's environment and the printed report looks correct for at
  least one real source, with selectors verified per
  `docs/CRAWLER.md`.
- An admin account exists and `/admin` is reachable only by it.
- The daily cron job appears in `cron.job` and has run at least once
  successfully.
