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
    POST   /announcements   create a new draft announcement
    PATCH  /announcements   edit an announcement's content and/or status, and log it
    PATCH  /sources         enable/disable a source or change its priority
    POST   /review/{id}/publish  approve a crawl_item: publish its title,
                                  or create one for an uncertain match.
                                  Takes an optional JSON body of field
                                  corrections, see ALLOWED_REVIEW_OVERRIDE_FIELDS
    POST   /review/{id}/reject   mark a crawl_item rejected, no title write
    POST   /review/{id}/merge    apply an uncertain match's data onto the
                                  title it matched, same as a confident
                                  crawler match would have. Also takes the
                                  same optional field corrections as publish

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
import json
import os
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
from fastapi import BackgroundTasks, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client

from .config import CRAWLER_SECRET, ENVIRONMENT, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL
from .main import LockedTitleError, apply_update_to_title, insert_new_title, link_title_source, run_crawl
from .models import RawCrawlItem
from .normalizer import slugify

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

# Explicit allow-list for the content fields PATCH /announcements and
# POST /announcements accept. status and slug are handled separately:
# status has its own check above, slug is generated server side on
# create so two announcements never collide.
ALLOWED_ANNOUNCEMENT_FIELDS = {
    "title",
    "summary",
    "content",
    "cover_image",
    "related_title_id",
    "source_url",
    "source_name",
    "announcement_type",
}

REQUIRED_ANNOUNCEMENT_FIELDS = {"title", "summary", "content", "announcement_type"}

# Matches the `announcement_type` check constraint
# (supabase/migrations/006_announcements.sql), checked here so a typo
# is a clean 400 instead of a raw Postgres constraint error.
ANNOUNCEMENT_TYPES = {
    "New Release",
    "Release Date",
    "Trailer",
    "Casting",
    "Production",
    "Streaming",
    "Poster",
    "Status Update",
    "Other GL",
}

# Explicit allow-list for the optional edits an admin can make while
# publishing or merging a review queue item (POST /review/{id}/publish
# and /merge), matched to RawCrawlItem's own field names (models.py),
# not the titles table's column names, since these get merged into the
# crawl_item's payload before it is re-validated as a RawCrawlItem.
# source_url, source_name, and the external ids are left out here on
# purpose: those identify where the item came from and should stay as
# the crawler found them, not be hand edited from a quick review form.
ALLOWED_REVIEW_OVERRIDE_FIELDS = {
    "title",
    "original_title",
    "type",
    "year",
    "release_date",
    "country",
    "language",
    "status",
    "episode_count",
    "runtime_minutes",
    "description",
    "poster_url",
    "official_url",
}

# Explicit allow-list for PATCH /sources: an admin can turn a source
# on/off and reorder it, not rewrite its URL or type from this
# endpoint (that still means editing the migration/seed data).
ALLOWED_SOURCE_FIELDS = {"enabled", "priority"}

# crawl_items.state values the review queue will act on. "duplicate"
# and "error" never reach here (see crawler/main.py); "rejected" means
# an admin already resolved it.
REVIEWABLE_STATES = {"new", "updated", "existing", "uncertain"}

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
    """Edits an announcement's content fields, its status, or both in
    one call. Previously this only ever changed status; there was no
    way to edit title/summary/content/etc. once a draft existed."""
    profile = _require_admin(authorization)
    body: dict[str, Any] = await request.json()

    announcement_id = body.get("id")
    if not announcement_id:
        raise HTTPException(status_code=400, detail="Missing id.")

    fields = {key: value for key, value in body.items() if key in ALLOWED_ANNOUNCEMENT_FIELDS}

    status = body.get("status")
    if status is not None:
        if status not in ALLOWED_ANNOUNCEMENT_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"status must be one of {sorted(ALLOWED_ANNOUNCEMENT_STATUSES)}.",
            )
        fields["status"] = status

    if not fields:
        raise HTTPException(status_code=400, detail="No editable fields provided.")
    fields["updated_at"] = _now_iso()

    admin = get_admin_client()
    try:
        updated_rows = admin.table("announcements").update(fields).eq("id", announcement_id).execute().data
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    if not updated_rows:
        raise HTTPException(status_code=404, detail="Announcement not found.")
    updated = updated_rows[0]

    action = "edit"
    if status == "published":
        action = "publish"
    elif status == "unpublished":
        action = "unpublish"

    admin.table("admin_actions").insert(
        {
            "admin_id": profile["id"],
            "action": action,
            "entity_type": "announcement",
            "entity_id": announcement_id,
            "new_value": updated,
        }
    ).execute()

    return {"announcement": updated}


@app.post("/announcements")
async def create_announcement(request: Request, authorization: Optional[str] = Header(None)) -> dict:
    """Creates a new announcement draft directly from the admin UI.
    There is no crawler source for announcements yet (see
    docs/CRAWLER.md), so until one exists, or as well as one once it
    does, this is how an admin writes one by hand."""
    profile = _require_admin(authorization)
    body: dict[str, Any] = await request.json()

    missing = REQUIRED_ANNOUNCEMENT_FIELDS - body.keys()
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing required field(s): {sorted(missing)}.")
    if body["announcement_type"] not in ANNOUNCEMENT_TYPES:
        raise HTTPException(status_code=400, detail=f"announcement_type must be one of {sorted(ANNOUNCEMENT_TYPES)}.")

    fields = {key: value for key, value in body.items() if key in ALLOWED_ANNOUNCEMENT_FIELDS}

    admin = get_admin_client()
    base_slug = slugify(fields["title"], None)
    slug = base_slug
    suffix = 2
    while admin.table("announcements").select("id").eq("slug", slug).limit(1).execute().data:
        slug = f"{base_slug}-{suffix}"
        suffix += 1
    fields["slug"] = slug
    fields["status"] = "draft"

    try:
        inserted_rows = admin.table("announcements").insert(fields).execute().data
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    if not inserted_rows:
        raise HTTPException(status_code=500, detail="Insert into announcements returned no row.")
    created = inserted_rows[0]

    admin.table("admin_actions").insert(
        {
            "admin_id": profile["id"],
            "action": "create",
            "entity_type": "announcement",
            "entity_id": created["id"],
            "new_value": created,
        }
    ).execute()

    return {"announcement": created}


@app.patch("/sources")
async def patch_source(request: Request, authorization: Optional[str] = Header(None)) -> dict:
    """Lets Admin -> Sources actually control the crawler (previously
    this page could only display sources, not change them; enabling or
    disabling one had no real effect anywhere)."""
    profile = _require_admin(authorization)
    body: dict[str, Any] = await request.json()

    source_id = body.get("id")
    if not source_id:
        raise HTTPException(status_code=400, detail="Missing source id.")

    fields = {key: value for key, value in body.items() if key in ALLOWED_SOURCE_FIELDS}
    if not fields:
        raise HTTPException(status_code=400, detail="No editable fields provided.")

    admin = get_admin_client()
    before = admin.table("sources").select("*").eq("id", source_id).maybe_single().execute().data
    if not before:
        raise HTTPException(status_code=404, detail="Source not found.")

    try:
        updated_rows = admin.table("sources").update(fields).eq("id", source_id).execute().data
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    updated = updated_rows[0] if updated_rows else None

    admin.table("admin_actions").insert(
        {
            "admin_id": profile["id"],
            "action": "edit",
            "entity_type": "source",
            "entity_id": source_id,
            "old_value": before,
            "new_value": updated,
        }
    ).execute()

    return {"source": updated}


def _load_reviewable_crawl_item(admin: Client, crawl_item_id: str) -> dict:
    crawl_item = admin.table("crawl_items").select("*").eq("id", crawl_item_id).maybe_single().execute().data
    if not crawl_item:
        raise HTTPException(status_code=404, detail="Crawl item not found.")
    if crawl_item["state"] not in REVIEWABLE_STATES:
        raise HTTPException(
            status_code=400,
            detail=f"crawl_item is '{crawl_item['state']}' and is not waiting for review.",
        )
    return crawl_item


async def _read_review_overrides(request: Request) -> dict:
    """POST /review/{id}/publish and /merge both used to take no body
    at all. A request with no body, or an empty JSON object, is the
    normal case (publish/merge with no corrections) and must not
    raise; anything present is filtered to ALLOWED_REVIEW_OVERRIDE_FIELDS
    so the rest of this file's field allow-list pattern still holds
    here too."""
    try:
        raw_body = await request.body()
        payload = json.loads(raw_body) if raw_body else {}
    except (json.JSONDecodeError, UnicodeDecodeError):
        payload = {}
    if not isinstance(payload, dict):
        return {}
    return {key: value for key, value in payload.items() if key in ALLOWED_REVIEW_OVERRIDE_FIELDS}


# ALLOWED_REVIEW_OVERRIDE_FIELDS uses RawCrawlItem's own field names
# (models.py). Most match the titles table's column names exactly;
# these three don't, so publish_review_item's already-existing-title
# branch (which writes straight to titles, not through
# crawler/main.py's build_title_fields) needs the rename.
_REVIEW_OVERRIDE_TO_TITLE_FIELD = {"title": "canonical_title", "year": "release_year", "status": "release_status"}


def _review_overrides_to_title_fields(overrides: dict) -> dict:
    fields = {}
    for key, value in overrides.items():
        db_key = _REVIEW_OVERRIDE_TO_TITLE_FIELD.get(key, key)
        if db_key == "type" and value:
            value = str(value).lower()  # matches the titles table's check constraint
        fields[db_key] = value
    return fields


@app.post("/review/{crawl_item_id}/publish")
async def publish_review_item(crawl_item_id: str, request: Request, authorization: Optional[str] = Header(None)) -> dict:
    """The admin review queue's Publish action. For a 'new' or
    'updated' item the crawler already wrote (or updated) the title;
    this just flips it live. For an 'uncertain' item, an admin looking
    at it decided it is not actually the title it was compared to, so
    this creates a new title for it instead, already published.

    Optionally takes a JSON body of field corrections (see
    ALLOWED_REVIEW_OVERRIDE_FIELDS), so an admin can fix a wrong title,
    year, description, poster, etc. right when they publish it instead
    of publishing the crawler's raw guess and fixing it in a second
    step."""
    profile = _require_admin(authorization)
    overrides = await _read_review_overrides(request)
    admin = get_admin_client()
    crawl_item = _load_reviewable_crawl_item(admin, crawl_item_id)

    if crawl_item["state"] == "uncertain":
        item = RawCrawlItem.model_validate({**crawl_item["payload"], **overrides})
        title_id = insert_new_title(admin, item, source_name=item.source_name, published=True)
        link_title_source(admin, title_id, crawl_item["source_id"], str(item.source_url))
        admin.table("crawl_items").update({"matched_title_id": title_id, "state": "new"}).eq(
            "id", crawl_item_id
        ).execute()
    else:
        title_id = crawl_item["matched_title_id"]
        if not title_id:
            raise HTTPException(status_code=400, detail="This crawl item has no title to publish.")
        title_fields = _review_overrides_to_title_fields(overrides)
        admin.table("titles").update({**title_fields, "is_published": True, "updated_at": _now_iso()}).eq(
            "id", title_id
        ).execute()

    title = admin.table("titles").select("*").eq("id", title_id).maybe_single().execute().data
    admin.table("admin_actions").insert(
        {
            "admin_id": profile["id"],
            "action": "publish",
            "entity_type": "title",
            "entity_id": title_id,
            "new_value": title,
        }
    ).execute()

    return {"title": title}


@app.post("/review/{crawl_item_id}/reject")
def reject_review_item(crawl_item_id: str, authorization: Optional[str] = Header(None)) -> dict:
    """Marks a crawl_item rejected and removes it from the queue. Does
    not delete or unpublish a title the crawler may already have
    created for a 'new'/'updated' item: rejecting the crawl record
    just stops it from being suggested again, it is not the same
    action as deleting a title (there is no title editor/delete flow
    yet, see ARCHITECTURE.md's phase list)."""
    profile = _require_admin(authorization)
    admin = get_admin_client()
    crawl_item = _load_reviewable_crawl_item(admin, crawl_item_id)

    updated = (
        admin.table("crawl_items").update({"state": "rejected"}).eq("id", crawl_item_id).execute().data
    )

    admin.table("admin_actions").insert(
        {
            "admin_id": profile["id"],
            "action": "reject",
            "entity_type": "crawl_item",
            "entity_id": crawl_item_id,
            "old_value": crawl_item,
        }
    ).execute()

    return {"crawl_item": updated[0] if updated else None}


@app.post("/review/{crawl_item_id}/merge")
async def merge_review_item(crawl_item_id: str, request: Request, authorization: Optional[str] = Header(None)) -> dict:
    """The admin review queue's Merge action: confirms an 'uncertain'
    match really is the same title crawler/deduplicator.py flagged it
    against, and applies the crawl item's data to it exactly like a
    confident crawler match would have.

    Takes the same optional field corrections as publish (see
    ALLOWED_REVIEW_OVERRIDE_FIELDS)."""
    profile = _require_admin(authorization)
    overrides = await _read_review_overrides(request)
    admin = get_admin_client()
    crawl_item = _load_reviewable_crawl_item(admin, crawl_item_id)

    title_id = crawl_item["matched_title_id"]
    if not title_id:
        raise HTTPException(status_code=400, detail="This crawl item has no matching title to merge into.")

    item = RawCrawlItem.model_validate({**crawl_item["payload"], **overrides})
    try:
        changed = apply_update_to_title(admin, title_id, item, crawl_item["source_id"], source_name=item.source_name)
    except LockedTitleError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    link_title_source(admin, title_id, crawl_item["source_id"], str(item.source_url))
    admin.table("crawl_items").update({"state": "updated" if changed else "existing"}).eq(
        "id", crawl_item_id
    ).execute()

    title = admin.table("titles").select("*").eq("id", title_id).maybe_single().execute().data
    admin.table("admin_actions").insert(
        {
            "admin_id": profile["id"],
            "action": "merge",
            "entity_type": "title",
            "entity_id": title_id,
            "new_value": title,
        }
    ).execute()

    return {"title": title}


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
