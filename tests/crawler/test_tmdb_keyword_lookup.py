"""Tests for TMDBAdapter's keyword id lookup (crawler/sources/tmdb.py).

The adapter used to trust a hardcoded list of TMDB keyword ids. Checking
that list against the live TMDB site showed most of the ids did not
match any real keyword, so the adapter now looks the current id up by
name through TMDB's own /search/keyword endpoint instead. These tests
use httpx.MockTransport so they run without any real network access.
"""
import httpx

from crawler.sources.tmdb import GL_EXTRA_KEYWORD_NAMES, GL_KEYWORD_NAMES, TMDBAdapter


def make_transport(keyword_results, discover_results, seen_requests=None):
    def handler(request: httpx.Request) -> httpx.Response:
        if seen_requests is not None:
            seen_requests.append(request)

        if request.url.path == "/3/search/keyword":
            query = request.url.params.get("query")
            return httpx.Response(200, json=keyword_results.get(query, {"results": []}))

        if request.url.path in ("/3/discover/tv", "/3/discover/movie"):
            page = request.url.params.get("page", "1")
            body = discover_results.get((request.url.path, page), {"results": [], "total_pages": 1})
            return httpx.Response(200, json=body)

        return httpx.Response(404, json={})

    return httpx.MockTransport(handler)


def test_resolve_keyword_ids_looks_up_each_name_on_tmdb():
    keyword_results = {
        "yuri": {"results": [{"id": 214564, "name": "yuri"}]},
        "lesbian": {"results": [{"id": 264386, "name": "lesbian"}]},
    }
    adapter = TMDBAdapter()

    with httpx.Client(transport=make_transport(keyword_results, {})) as client:
        keyword_ids = adapter._resolve_keyword_ids(client)

    assert keyword_ids == "214564|264386"


def test_resolve_keyword_ids_skips_a_name_tmdb_has_no_keyword_for():
    keyword_results = {
        "yuri": {"results": [{"id": 214564, "name": "yuri"}]},
        "lesbian": {"results": []},
    }
    adapter = TMDBAdapter()

    with httpx.Client(transport=make_transport(keyword_results, {})) as client:
        keyword_ids = adapter._resolve_keyword_ids(client)

    assert keyword_ids == "214564"


def test_resolve_keyword_ids_is_cached_after_the_first_call():
    keyword_results = {
        "yuri": {"results": [{"id": 214564, "name": "yuri"}]},
        "lesbian": {"results": [{"id": 264386, "name": "lesbian"}]},
    }
    seen_requests = []
    adapter = TMDBAdapter()

    with httpx.Client(transport=make_transport(keyword_results, {}, seen_requests)) as client:
        adapter._resolve_keyword_ids(client)
        adapter._resolve_keyword_ids(client)

    keyword_lookups = [r for r in seen_requests if r.url.path == "/3/search/keyword"]
    # One lookup per name (main names plus extras), not double that, so the
    # cache held on the second call.
    assert len(keyword_lookups) == len(GL_KEYWORD_NAMES) + len(GL_EXTRA_KEYWORD_NAMES)


def test_fetch_passes_the_resolved_ids_to_discover_endpoints(monkeypatch):
    monkeypatch.setattr("crawler.sources.tmdb.TMDB_API_KEY", "test-key")

    keyword_results = {
        "yuri": {"results": [{"id": 214564, "name": "yuri"}]},
        "lesbian": {"results": [{"id": 264386, "name": "lesbian"}]},
    }
    discover_results = {
        ("/3/discover/tv", "1"): {"results": [], "total_pages": 1},
        ("/3/discover/movie", "1"): {"results": [], "total_pages": 1},
    }
    seen_requests = []
    adapter = TMDBAdapter()

    with httpx.Client(transport=make_transport(keyword_results, discover_results, seen_requests)) as client:
        adapter.fetch(client)

    discover_calls = [r for r in seen_requests if "/discover/" in r.url.path]
    assert discover_calls, "expected at least one /discover call"
    for call in discover_calls:
        assert call.url.params.get("with_keywords") == "214564|264386"


def test_fetch_returns_nothing_when_tmdb_has_no_matching_keyword_at_all(monkeypatch):
    monkeypatch.setattr("crawler.sources.tmdb.TMDB_API_KEY", "test-key")

    keyword_results = {"yuri": {"results": []}, "lesbian": {"results": []}}
    adapter = TMDBAdapter()

    with httpx.Client(transport=make_transport(keyword_results, {})) as client:
        payloads = adapter.fetch(client)

    assert payloads == []
