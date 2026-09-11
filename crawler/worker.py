"""FastAPI backend for admin-only actions and the crawler trigger.

This is the other half of the single `npm run dev` command described
in ARCHITECTURE.md. Everything else in the app (browsing the catalog,
signing in, personal tracking) talks to Supabase directly from the
browser and relies on Row Level Security (see
supabase/migrations/009_rls.sql). This process exists only for the
handful of actions that need the service-role key, which must never
reach the browser:

    GET    /health          liveness check, no auth required
    POST   /run             queue and start a crawl run
    GET    /runs/{run_id}   poll one crawl run's live status
    PATCH  /titles          edit a title and log the admin action
    PATCH  /announcements   change an announcement's status and log it

Run it directly with:

    uvicorn crawler.worker:app --host 0.0.0.0 --port 8787

or use `npm run dev`, which starts this alongside the Vite frontend,
see package.json and docs/SETUP.md.

Runs as a single Uvicorn worker process (do not pass --workers > 1):
the crawl lock in POST /run below only prevents two overlapping crawls
within one process's memory, and the crawl itself runs as a background
task inside this same process, not a separate job queue. See
docs/DEPLOYMENT.md.
"""
import os
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
from fastapi import BackgroundTasks, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client

from .config import CRAWLER_SECRET, ENVIRONMENT, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL
from .main import run_crawl

# Allowed origin for browser requests. "*" is fine for local
# development; set FRONTEND_ORIGIN to your deployed frontend's exact
# URL once this backend is deployed somewhere real, see
# docs/DEPLOYMENT.md. ENVIRONMENT=production with FRONTEND_ORIGIN still
# "*" is refused at startup rather than silently deployed wide open.
FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "*")

if ENVIRONMENT == "production" and FRONTEND_ORIGIN == "*":
    raise RuntimeError(
        "FRONTEND_ORIGIN must be set to your deployed frontend's exact URL when "
        "ENVIRONMENT=production. '*' is only meant for local development, see "
        "docs/DEPLOYMENT.md."
    )

# Explicit allow-list for PATCH /titles. Previously any key the client
# sent (other than "id") was written straight to the database; an
# admin-only endpoint is still not a reason to accept arbitrary fields.
ALLOWED_TITLE_FIELDS = {
    "canonical_title",
    "original_title",
    "canonical_slug",
    "type",
    "country",
    "language",
    "release_year",
    "release_date",
    "release_status",
    "description",
    "poster_url",
    "backdrop_url",
    "episode_count",
    "runtime_minutes",
    "official_url",
    "tmdb_id",
    "imdb_id",
    "classification_source",
    "is_published",
    "is_locked",
    "merged_into",
}

# Matches the `status` check constraint on announcements
# (supabase/migrations/006_announcements.sql). Previously whatever the
# client sent was passed straight to Postgres and only a check
# constraint violation (a raw 500) caught a typo.
ALLOWED_ANNOUNCEMENT_STATUSES = {"draft", "published", "unpublished"}

# crawl_runs.status values that mean "already busy" (see
# supabase/migrations/005_crawler.sql). POST /run refuses to start a
# second crawl while one of these is in progress.
ACTIVE_RUN_STATUSES = ("queued", "running")

app = FastAPI(title="LilyBlossom backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "x-crawler-secret"],
)


class RunRequest(BaseModel):
    dry_run: bool = False


def get_admin_client() -> Client:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError(
            "VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env "
            "for the backend to talk to Supabase."
        )
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def get_admin_profile_from_token(access_token: str) -> Optional[dict]:
    """Verify a Supabase access token and return the caller's profile
    row if, and only if, they are an admin. This replaces the old
    server-side requireAdmin() helper (lib/auth/session.ts), now that
    there is no server-rendered app to run that check inside of.
    Row Level Security is still the real boundary either way, see
    docs/ADMIN.md.
    """
    if not access_token:
        return None

    try:
        response = httpx.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {access_token}",
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
            },
            timeout=10,
        )
    except httpx.HTTPError:
        return None

    if response.status_code != 200:
        return None

    user_id = response.json().get("id")
    if not user_id:
        return None

    admin = get_admin_client()
    result = admin.table("profiles").select("id, role").eq("id", user_id).maybe_single().execute()
    profile = result.data
    if not profile or profile.get("role") != "admin":
        return None
    return profile


def _bearer_token(authorization: Optional[str]) -> str:
    if authorization and authorization.startswith("Bearer "):
        return authorization[len("Bearer "):]
    return ""


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _require_admin(authorization: Optional[str]) -> dict:
    profile = get_admin_profile_from_token(_bearer_token(authorization))
    if not profile:
        raise HTTPException(status_code=401, detail="Admin access required.")
    return profile


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


def _execute_run(run_id: str, dry_run: bool) -> None:
    """Runs the crawl in the background and always leaves crawl_runs in
    a final state, even if run_crawl() raises before it gets the chance
    to update its own row (for example, a Supabase connection error)."""
    admin = get_admin_client()
    try:
        run_crawl(dry_run=dry_run, run_id=run_id, supabase=admin)
    except Exception as exc:  # noqa: BLE001
        print(f"Crawl failed: {exc}")
        try:
            admin.table("crawl_runs").update(
                {"status": "failed", "finished_at": _now_iso()}
            ).eq("id", run_id).execute()
        except Exception as inner_exc:  # noqa: BLE001
            print(f"Could not record crawl failure: {inner_exc}")


@app.post("/run")
def start_run(
    body: RunRequest,
    background_tasks: BackgroundTasks,
    authorization: Optional[str] = Header(None),
    x_crawler_secret: Optional[str] = Header(None),
) -> dict:
    """Queues and starts one crawl. Only an authenticated admin, or the
    scheduler using CRAWLER_SECRET, may call this. Refuses to start a
    second crawl while one is already queued or running (previously an
    admin double clicking "Run Crawl Now" could start multiple crawler
    threads at once against the same database)."""
    is_scheduler = bool(x_crawler_secret) and x_crawler_secret == CRAWLER_SECRET
    if not is_scheduler:
        _require_admin(authorization)

    admin = get_admin_client()

    active = (
        admin.table("crawl_runs")
        .select("id, status")
        .in_("status", list(ACTIVE_RUN_STATUSES))
        .limit(1)
        .execute()
        .data
    )
    if active:
        raise HTTPException(
            status_code=409,
            detail=f"A crawl is already {active[0]['status']} (run {active[0]['id']}).",
        )

    result = admin.table("crawl_runs").insert({"status": "queued", "started_at": _now_iso()}).execute()
    run = result.data[0] if result.data else None
    if not run:
        raise HTTPException(status_code=500, detail="Could not create a crawl run.")

    background_tasks.add_task(_execute_run, run["id"], body.dry_run)
    return {"run_id": run["id"], "status": "queued"}


@app.get("/runs/{run_id}")
def get_run(run_id: str, authorization: Optional[str] = Header(None)) -> dict:
    """Lets the admin crawler page poll a single run's live status
    instead of only ever seeing the most recently loaded snapshot."""
    _require_admin(authorization)
    admin = get_admin_client()
    result = admin.table("crawl_runs").select("*").eq("id", run_id).maybe_single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Run not found.")
    return {"run": result.data}


@app.patch("/titles")
async def patch_title(request: Request, authorization: Optional[str] = Header(None)) -> dict:
    """The only write path for global catalog edits made directly by a
    human admin, as opposed to the crawler pipeline."""
    profile = _require_admin(authorization)
    body: dict[str, Any] = await request.json()

    title_id = body.get("id")
    if not title_id:
        raise HTTPException(status_code=400, detail="Missing title id.")

    fields = {key: value for key, value in body.items() if key in ALLOWED_TITLE_FIELDS}
    if not fields:
        raise HTTPException(status_code=400, detail="No editable fields provided.")
    fields["updated_at"] = _now_iso()

    admin = get_admin_client()
    before = admin.table("titles").select("*").eq("id", title_id).maybe_single().execute().data
    if not before:
        raise HTTPException(status_code=404, detail="Title not found.")

    try:
        updated_rows = admin.table("titles").update(fields).eq("id", title_id).execute().data
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    updated = updated_rows[0] if updated_rows else None

    admin.table("admin_actions").insert(
        {
            "admin_id": profile["id"],
            "action": "edit",
            "entity_type": "title",
            "entity_id": title_id,
            "old_value": before,
            "new_value": updated,
        }
    ).execute()

    return {"title": updated}


@app.patch("/announcements")
async def patch_announcement(request: Request, authorization: Optional[str] = Header(None)) -> dict:
    profile = _require_admin(authorization)
    body: dict[str, Any] = await request.json()

    announcement_id = body.get("id")
    status = body.get("status")
    if not announcement_id or not status:
        raise HTTPException(status_code=400, detail="Missing id or status.")
    if status not in ALLOWED_ANNOUNCEMENT_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"status must be one of {sorted(ALLOWED_ANNOUNCEMENT_STATUSES)}.",
        )

    admin = get_admin_client()
    try:
        updated_rows = (
            admin.table("announcements")
            .update({"status": status, "updated_at": _now_iso()})
            .eq("id", announcement_id)
            .execute()
            .data
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    if not updated_rows:
        raise HTTPException(status_code=404, detail="Announcement not found.")
    updated = updated_rows[0]

    admin.table("admin_actions").insert(
        {
            "admin_id": profile["id"],
            "action": "publish" if status == "published" else "unpublish",
            "entity_type": "announcement",
            "entity_id": announcement_id,
            "new_value": updated,
        }
    ).execute()

    return {"announcement": updated}


if __name__ == "__main__":
    import uvicorn
    from .config import CRAWLER_WORKER_PORT

    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print(
            "Warning: VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set. "
            "Copy .env.example to .env and fill in your Supabase project values "
            "before triggering a crawl or an admin action."
        )
    print(f"LilyBlossom backend listening on http://localhost:{CRAWLER_WORKER_PORT}")
    uvicorn.run(app, host="0.0.0.0", port=CRAWLER_WORKER_PORT, workers=1)
