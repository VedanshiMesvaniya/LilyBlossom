"""Tests for store_poster_for_title (crawler/poster_handler.py).

Uses small in-memory fakes for both httpx.get and the Supabase client,
since the point of these tests is the upload / dedupe / fallback logic,
not httpx or the real Supabase Python client.
"""
import httpx
import pytest

from crawler import poster_handler
from crawler.poster_handler import (
    PosterFetchError,
    build_storage_path,
    guess_extension,
    store_poster_for_title,
)

FAKE_IMAGE_BYTES = b"fake-jpeg-bytes"


class FakeResponse:
    def __init__(self, content, content_type="image/jpeg", status_code=200):
        self.content = content
        self.headers = {"content-type": content_type}
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("error", request=None, response=self)


class FakeQuery:
    def __init__(self, table_name, store):
        self.table_name = table_name
        self.store = store
        self.filters = {}
        self.insert_payload = None
        self.is_select = False

    def select(self, *_args):
        self.is_select = True
        return self

    def eq(self, key, value):
        self.filters[key] = value
        return self

    def limit(self, _n):
        return self

    def insert(self, payload):
        self.insert_payload = payload
        return self

    def execute(self):
        if self.insert_payload is not None:
            self.store.setdefault(self.table_name, []).append(self.insert_payload)
            return FakeResult([self.insert_payload])
        if self.is_select:
            rows = self.store.get(self.table_name, [])
            matched = [row for row in rows if all(row.get(k) == v for k, v in self.filters.items())]
            return FakeResult(matched)
        return FakeResult([])


class FakeResult:
    def __init__(self, data):
        self.data = data


class FakeStorageBucket:
    def __init__(self, uploads, fail=False):
        self.uploads = uploads
        self.fail = fail

    def upload(self, path, data, options):
        if self.fail:
            raise RuntimeError("simulated storage failure")
        self.uploads.append({"path": path, "data": data, "options": options})

    def get_public_url(self, path):
        return f"https://fake.supabase.co/storage/v1/object/public/title-posters/{path}"


class FakeStorage:
    def __init__(self, uploads, fail=False):
        self.uploads = uploads
        self.fail = fail

    def from_(self, _bucket):
        return FakeStorageBucket(self.uploads, fail=self.fail)


class FakeSupabase:
    def __init__(self, seed=None, fail_upload=False):
        self.store = {k: list(v) for k, v in (seed or {}).items()}
        self.uploads = []
        self.storage = FakeStorage(self.uploads, fail=fail_upload)

    def table(self, name):
        return FakeQuery(name, self.store)


def test_downloads_uploads_and_records_a_new_poster(monkeypatch):
    monkeypatch.setattr(poster_handler.httpx, "get", lambda *a, **k: FakeResponse(FAKE_IMAGE_BYTES))
    supabase = FakeSupabase()

    result_url = store_poster_for_title(
        supabase, "title-1", "the-loyal-pin-2024", "https://example.invalid/poster.jpg", "TMDB"
    )

    assert result_url is not None
    assert len(supabase.uploads) == 1
    assert supabase.uploads[0]["data"] == FAKE_IMAGE_BYTES
    assert supabase.uploads[0]["path"].startswith("the-loyal-pin-2024/")
    [recorded] = supabase.store["poster_assets"]
    assert recorded["title_id"] == "title-1"
    assert recorded["source_url"] == "https://example.invalid/poster.jpg"
    assert recorded["source_name"] == "TMDB"


def test_reuses_an_existing_file_instead_of_re_uploading_the_same_image(monkeypatch):
    monkeypatch.setattr(poster_handler.httpx, "get", lambda *a, **k: FakeResponse(FAKE_IMAGE_BYTES))
    image_hash = poster_handler.hash_poster(FAKE_IMAGE_BYTES)
    supabase = FakeSupabase(
        seed={
            "poster_assets": [
                {"title_id": "title-1", "hash": image_hash, "storage_path": "the-loyal-pin-2024/abc123.jpg"}
            ]
        }
    )

    result_url = store_poster_for_title(
        supabase, "title-1", "the-loyal-pin-2024", "https://example.invalid/poster.jpg", "TMDB"
    )

    assert result_url == "https://fake.supabase.co/storage/v1/object/public/title-posters/the-loyal-pin-2024/abc123.jpg"
    assert supabase.uploads == []  # no new upload for an image already stored for this title


def test_returns_none_when_the_source_image_cannot_be_downloaded(monkeypatch):
    def raise_fetch_error(*_a, **_k):
        raise httpx.ConnectError("could not connect")

    monkeypatch.setattr(poster_handler.httpx, "get", raise_fetch_error)
    supabase = FakeSupabase()

    result_url = store_poster_for_title(
        supabase, "title-1", "the-loyal-pin-2024", "https://example.invalid/missing.jpg", "TMDB"
    )

    assert result_url is None
    assert supabase.uploads == []
    assert supabase.store.get("poster_assets", []) == []


def test_returns_none_when_the_storage_upload_fails(monkeypatch):
    monkeypatch.setattr(poster_handler.httpx, "get", lambda *a, **k: FakeResponse(FAKE_IMAGE_BYTES))
    supabase = FakeSupabase(fail_upload=True)

    result_url = store_poster_for_title(
        supabase, "title-1", "the-loyal-pin-2024", "https://example.invalid/poster.jpg", "TMDB"
    )

    assert result_url is None
    # Upload failed, so nothing should have been recorded either.
    assert supabase.store.get("poster_assets", []) == []


def test_guess_extension_prefers_content_type_over_the_url():
    assert guess_extension("https://example.invalid/image", "image/png") == "png"


def test_guess_extension_falls_back_to_the_url_extension():
    assert guess_extension("https://example.invalid/poster.webp", None) == "webp"


def test_guess_extension_defaults_to_jpg_when_nothing_is_known():
    assert guess_extension("https://example.invalid/no-extension-here", None) == "jpg"


def test_build_storage_path_uses_the_slug_and_a_short_hash_prefix():
    path = build_storage_path("the-loyal-pin-2024", "0123456789abcdef" + "f" * 48, "png")
    assert path == "the-loyal-pin-2024/0123456789abcdef.png"
