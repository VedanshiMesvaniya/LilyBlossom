"""Tests for the admin review endpoints in crawler/worker.py:
POST /review/{id}/publish, /reject, /merge, and PATCH /sources.

Uses FastAPI's TestClient with the admin-auth check and the Supabase
client both replaced by test doubles, since these endpoints only make
sense against a signed-in admin and a real (or fake) database.
"""
import os

os.environ.setdefault("VITE_SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-key")
os.environ.setdefault("ENVIRONMENT", "development")

from fastapi.testclient import TestClient

from crawler import worker


class FakeQuery:
    def __init__(self, db, table_name, op, filters=None, payload=None):
        self.db = db
        self.table_name = table_name
        self.op = op
        self.filters = filters or {}
        self.payload = payload

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, field, value):
        self.filters[field] = value
        return self

    def limit(self, _n):
        return self

    def maybe_single(self):
        return self

    def single(self):
        return self

    def execute(self):
        return self.db._run(self)


class FakeResult:
    def __init__(self, data):
        self.data = data


class FakeTable:
    def __init__(self, db, name):
        self.db = db
        self.name = name

    def select(self, *_args, **_kwargs):
        return FakeQuery(self.db, self.name, "select")

    def insert(self, payload):
        return FakeQuery(self.db, self.name, "insert", payload=payload)

    def update(self, payload):
        return FakeQuery(self.db, self.name, "update", payload=payload)

    def upsert(self, payload, on_conflict=None):  # noqa: ARG002
        return FakeQuery(self.db, self.name, "upsert", payload=payload)


class FakeAdminClient:
    """A tiny generic table store: enough for crawl_items, titles,
    sources, announcements, and admin_actions rows keyed by id."""

    def __init__(self, seed: dict[str, list[dict]]):
        self.rows = {name: {row["id"]: dict(row) for row in items} for name, items in seed.items()}
        self.inserted = {name: [] for name in seed}
        self._next_id = 1

    def table(self, name):
        self.rows.setdefault(name, {})
        self.inserted.setdefault(name, [])
        return FakeTable(self, name)

    def _run(self, query):
        table = self.rows[query.table_name]

        if query.op in ("select", "maybe_single", "single"):
            matches = [row for row in table.values() if all(row.get(k) == v for k, v in query.filters.items())]
            return FakeResult(matches[0] if matches else None) if "id" in query.filters else FakeResult(matches)

        if query.op == "insert":
            new_id = query.payload.get("id") or f"generated-{self._next_id}"
            self._next_id += 1
            row = {"id": new_id, **query.payload}
            table[new_id] = row
            self.inserted[query.table_name].append(row)
            return FakeResult([row])

        if query.op == "update":
            updated = []
            for row_id, row in table.items():
                if all(row.get(k) == v for k, v in query.filters.items()):
                    row.update(query.payload)
                    updated.append(row)
            return FakeResult(updated)

        if query.op == "upsert":
            row_id = f"{query.payload.get('title_id')}:{query.payload.get('source_id')}"
            table[row_id] = query.payload
            return FakeResult([query.payload])

        raise AssertionError(f"Unhandled op {query.op} on {query.table_name}")


def make_client(seed):
    fake = FakeAdminClient(seed)
    worker.get_admin_client = lambda: fake  # noqa: ARG005 - monkeypatch, restored per-test via fixture-less simplicity
    worker._require_admin = lambda authorization: {"id": "admin-1", "role": "admin"}  # noqa: ARG005
    return fake, TestClient(worker.app)


UNCERTAIN_PAYLOAD = {
    "title": "A Brand New Show",
    "type": "Series",
    "year": 2025,
    "source_url": "https://example.invalid/a",
    "source_name": "GL Archive",
}


def test_publish_uncertain_item_creates_a_published_title():
    fake, client = make_client(
        {
            "crawl_items": [
                {
                    "id": "ci-1",
                    "state": "uncertain",
                    "matched_title_id": "title-1",
                    "source_id": "src-1",
                    "payload": UNCERTAIN_PAYLOAD,
                }
            ],
            "titles": [{"id": "title-1", "canonical_title": "Something Else", "is_locked": False}],
        }
    )

    response = client.post("/review/ci-1/publish", headers={"Authorization": "Bearer token"})

    assert response.status_code == 200
    new_title = response.json()["title"]
    assert new_title["is_published"] is True
    assert new_title["type"] == "series"
    assert fake.rows["crawl_items"]["ci-1"]["state"] == "new"
    assert fake.inserted["admin_actions"][0]["action"] == "publish"


def test_publish_new_item_just_flips_is_published():
    fake, client = make_client(
        {
            "crawl_items": [
                {"id": "ci-2", "state": "new", "matched_title_id": "title-2", "source_id": "src-1", "payload": UNCERTAIN_PAYLOAD}
            ],
            "titles": [{"id": "title-2", "canonical_title": "Already Created By Crawler", "is_published": False}],
        }
    )

    response = client.post("/review/ci-2/publish", headers={"Authorization": "Bearer token"})

    assert response.status_code == 200
    assert fake.rows["titles"]["title-2"]["is_published"] is True


def test_reject_marks_crawl_item_rejected_without_touching_titles():
    fake, client = make_client(
        {
            "crawl_items": [{"id": "ci-3", "state": "uncertain", "matched_title_id": "title-3", "source_id": "src-1", "payload": UNCERTAIN_PAYLOAD}],
            "titles": [{"id": "title-3", "canonical_title": "Untouched", "is_published": False}],
        }
    )

    response = client.post("/review/ci-3/reject", headers={"Authorization": "Bearer token"})

    assert response.status_code == 200
    assert fake.rows["crawl_items"]["ci-3"]["state"] == "rejected"
    assert fake.rows["titles"]["title-3"]["is_published"] is False  # untouched


def test_merge_applies_changes_and_refuses_locked_titles():
    fake, client = make_client(
        {
            "crawl_items": [
                {"id": "ci-4", "state": "uncertain", "matched_title_id": "title-4", "source_id": "src-1", "payload": {**UNCERTAIN_PAYLOAD, "status": "Airing"}}
            ],
            "titles": [{"id": "title-4", "canonical_title": "A Brand New Show", "release_status": "Upcoming", "is_locked": False}],
        }
    )

    response = client.post("/review/ci-4/merge", headers={"Authorization": "Bearer token"})
    assert response.status_code == 200
    assert fake.rows["titles"]["title-4"]["release_status"] == "Airing"
    assert fake.rows["crawl_items"]["ci-4"]["state"] == "updated"

    # Now try to merge into a locked title: should be refused, not silently ignored.
    fake2, client2 = make_client(
        {
            "crawl_items": [
                {"id": "ci-5", "state": "uncertain", "matched_title_id": "title-5", "source_id": "src-1", "payload": {**UNCERTAIN_PAYLOAD, "status": "Airing"}}
            ],
            "titles": [{"id": "title-5", "canonical_title": "Locked Show", "release_status": "Upcoming", "is_locked": True}],
        }
    )
    response2 = client2.post("/review/ci-5/merge", headers={"Authorization": "Bearer token"})
    assert response2.status_code == 400


def test_patch_sources_only_allows_enabled_and_priority():
    fake, client = make_client(
        {"sources": [{"id": "src-1", "name": "GL Archive", "url": "https://glarchive.net", "enabled": True, "priority": 10}]}
    )

    response = client.patch(
        "/sources", json={"id": "src-1", "enabled": False, "url": "https://evil.example"}, headers={"Authorization": "Bearer token"}
    )

    assert response.status_code == 200
    assert fake.rows["sources"]["src-1"]["enabled"] is False
    assert fake.rows["sources"]["src-1"]["url"] == "https://glarchive.net"  # url is not in the allow-list
