"""Small local backend for admin-only actions and the crawler trigger.

This is the other half of the single `npm run dev` command described
in ARCHITECTURE.md. Everything else in the app (browsing the catalog,
signing in, personal tracking) talks to Supabase directly from the
browser and relies on Row Level Security (see
supabase/migrations/009_rls.sql). This process exists only for the
handful of actions that need the service-role key, which must never
reach the browser:

    GET    /health          liveness check, no auth required
    POST   /run             queue and start a crawl run
    PATCH  /titles          edit a title and log the admin action
    PATCH  /announcements   change an announcement's status and log it

Run it directly with:

    python -m crawler.worker

or use `npm run dev`, which starts this alongside the Vite frontend,
see package.json and docs/SETUP.md.

Uses only the Python standard library's http.server for the HTTP
layer, so no new dependency was needed beyond what crawler/main.py
already required.
"""
import json
import os
import threading
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import httpx
from supabase import create_client, Client

from .config import CRAWLER_SECRET, CRAWLER_WORKER_PORT, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL
from .main import run_crawl

# Allowed origin for browser requests. "*" is fine for local
# development; set FRONTEND_ORIGIN to your deployed frontend's URL
# once this backend is deployed somewhere real, see docs/DEPLOYMENT.md.
FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "*")


def get_admin_client() -> Client:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError(
            "VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env "
            "for the backend to talk to Supabase."
        )
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def get_admin_profile_from_token(access_token: str):
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


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class Handler(BaseHTTPRequestHandler):
    def _set_cors(self):
        self.send_header("Access-Control-Allow-Origin", FRONTEND_ORIGIN)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-crawler-secret")

    def _send_json(self, status: int, payload: dict):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self._set_cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json_body(self) -> dict:
        length = int(self.headers.get("Content-Length", 0) or 0)
        if length == 0:
            return {}
        raw = self.rfile.read(length)
        try:
            return json.loads(raw or b"{}")
        except json.JSONDecodeError:
            return {}

    def _bearer_token(self) -> str:
        auth = self.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            return auth[len("Bearer "):]
        return ""

    def do_OPTIONS(self):
        self.send_response(204)
        self._set_cors()
        self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            self._send_json(200, {"status": "ok"})
            return
        self._send_json(404, {"error": "Not found."})

    def do_POST(self):
        if self.path == "/run":
            self._handle_run()
            return
        self._send_json(404, {"error": "Not found."})

    def do_PATCH(self):
        if self.path == "/titles":
            self._handle_titles_patch()
            return
        if self.path == "/announcements":
            self._handle_announcements_patch()
            return
        self._send_json(404, {"error": "Not found."})

    # POST /run
    # Only an authenticated admin, or the scheduler using
    # CRAWLER_SECRET, may trigger a crawl. Queues a run row, then
    # starts the crawl in a background thread so the request returns
    # right away; run_crawl() (crawler/main.py) writes its own summary
    # row when it finishes.
    def _handle_run(self):
        secret_header = self.headers.get("x-crawler-secret", "")
        is_scheduler = bool(secret_header) and secret_header == CRAWLER_SECRET

        if not is_scheduler:
            profile = get_admin_profile_from_token(self._bearer_token())
            if not profile:
                self._send_json(401, {"error": "Admin access required."})
                return

        body = self._read_json_body()
        dry_run = bool(body.get("dry_run", False))

        try:
            admin = get_admin_client()
            result = admin.table("crawl_runs").insert(
                {"status": "queued", "started_at": _now_iso()}
            ).execute()
            run = result.data[0] if result.data else None
        except Exception as exc:  # noqa: BLE001
            self._send_json(500, {"error": str(exc)})
            return

        threading.Thread(target=self._run_crawl_safely, args=(dry_run,), daemon=True).start()
        self._send_json(200, {"run": run})

    def _run_crawl_safely(self, dry_run: bool):
        try:
            run_crawl(dry_run=dry_run)
        except Exception as exc:  # noqa: BLE001
            print(f"Crawl failed: {exc}")

    # PATCH /titles  { id, ...fields }
    # The only write path for global catalog edits made directly by a
    # human admin, as opposed to the crawler pipeline.
    def _handle_titles_patch(self):
        profile = get_admin_profile_from_token(self._bearer_token())
        if not profile:
            self._send_json(401, {"error": "Admin access required."})
            return

        body = self._read_json_body()
        title_id = body.get("id")
        if not title_id:
            self._send_json(400, {"error": "Missing title id."})
            return

        fields = {key: value for key, value in body.items() if key != "id"}
        fields["updated_at"] = _now_iso()

        admin = get_admin_client()
        before = admin.table("titles").select("*").eq("id", title_id).single().execute().data

        try:
            updated = admin.table("titles").update(fields).eq("id", title_id).execute().data[0]
        except Exception as exc:  # noqa: BLE001
            self._send_json(500, {"error": str(exc)})
            return

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

        self._send_json(200, {"title": updated})

    # PATCH /announcements  { id, status }
    def _handle_announcements_patch(self):
        profile = get_admin_profile_from_token(self._bearer_token())
        if not profile:
            self._send_json(401, {"error": "Admin access required."})
            return

        body = self._read_json_body()
        announcement_id = body.get("id")
        status = body.get("status")
        if not announcement_id or not status:
            self._send_json(400, {"error": "Missing id or status."})
            return

        admin = get_admin_client()
        try:
            updated = (
                admin.table("announcements")
                .update({"status": status, "updated_at": _now_iso()})
                .eq("id", announcement_id)
                .execute()
                .data[0]
            )
        except Exception as exc:  # noqa: BLE001
            self._send_json(500, {"error": str(exc)})
            return

        admin.table("admin_actions").insert(
            {
                "admin_id": profile["id"],
                "action": "publish" if status == "published" else "unpublish",
                "entity_type": "announcement",
                "entity_id": announcement_id,
                "new_value": updated,
            }
        ).execute()

        self._send_json(200, {"announcement": updated})

    def log_message(self, format, *args):  # noqa: A002
        # Slightly quieter than the default, one line per request.
        print(f"[backend] {self.address_string()} {format % args}")


def serve():
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print(
            "Warning: VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set. "
            "Copy .env.example to .env and fill in your Supabase project values "
            "before triggering a crawl or an admin action."
        )

    server = ThreadingHTTPServer(("0.0.0.0", CRAWLER_WORKER_PORT), Handler)
    print(f"LilyBlossom backend listening on http://localhost:{CRAWLER_WORKER_PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()


if __name__ == "__main__":
    serve()
