"""Tests for MyAnimeListAdapter (crawler/sources/jikan.py): the Girls
Love/Yuri genre id lookup, pagination, and mapping MAL's own fields
onto RawCrawlItem. Uses httpx.MockTransport, no real network access
to api.jikan.moe.
"""
import json

import httpx

from crawler.sources.jikan import MyAnimeListAdapter


def make_transport(genre_response, anime_pages, seen_requests=None):
    def handler(request: httpx.Request) -> httpx.Response:
        if seen_requests is not None:
            seen_requests.append(request)
        if request.url.path == "/v4/genres/anime":
            return httpx.Response(200, json=genre_response)
        if request.url.path == "/v4/anime":
            page = request.url.params.get("page", "1")
            return httpx.Response(200, json=anime_pages.get(page, {"data": [], "pagination": {"has_next_page": False}}))
        return httpx.Response(404, json={})

    return httpx.MockTransport(handler)


GENRE_RESPONSE = {"data": [{"mal_id": 62, "name": "Girls Love"}, {"mal_id": 8, "name": "Drama"}]}


def test_resolve_genre_id_finds_girls_love_by_name():
    adapter = MyAnimeListAdapter()
    with httpx.Client(transport=make_transport(GENRE_RESPONSE, {})) as client:
        genre_id = adapter._resolve_genre_id(client)

    assert genre_id == 62


def test_resolve_genre_id_also_matches_the_older_yuri_name():
    adapter = MyAnimeListAdapter()
    genre_response = {"data": [{"mal_id": 28, "name": "Yuri"}]}
    with httpx.Client(transport=make_transport(genre_response, {})) as client:
        genre_id = adapter._resolve_genre_id(client)

    assert genre_id == 28


def test_resolve_genre_id_returns_none_when_mal_has_neither_name():
    adapter = MyAnimeListAdapter()
    with httpx.Client(transport=make_transport({"data": [{"mal_id": 8, "name": "Drama"}]}, {})) as client:
        genre_id = adapter._resolve_genre_id(client)

    assert genre_id is None


def test_fetch_returns_nothing_when_the_genre_cannot_be_resolved(monkeypatch):
    monkeypatch.setattr("crawler.sources.jikan.time.sleep", lambda *_a: None)
    adapter = MyAnimeListAdapter()
    with httpx.Client(transport=make_transport({"data": []}, {})) as client:
        payloads = adapter.fetch(client)

    assert payloads == []


def test_fetch_follows_has_next_page_up_to_the_configured_limit(monkeypatch):
    monkeypatch.setattr("crawler.sources.jikan.time.sleep", lambda *_a: None)  # skip the real politeness delay in tests
    anime_pages = {
        "1": {"data": [{"mal_id": 1}], "pagination": {"has_next_page": True}},
        "2": {"data": [{"mal_id": 2}], "pagination": {"has_next_page": True}},
        "3": {"data": [{"mal_id": 3}], "pagination": {"has_next_page": False}},
    }
    adapter = MyAnimeListAdapter()
    with httpx.Client(transport=make_transport(GENRE_RESPONSE, anime_pages)) as client:
        payloads = adapter.fetch(client)

    assert len(payloads) == 3


def test_fetch_sends_the_resolved_genre_id_to_the_anime_endpoint(monkeypatch):
    monkeypatch.setattr("crawler.sources.jikan.time.sleep", lambda *_a: None)
    seen_requests = []
    adapter = MyAnimeListAdapter()
    with httpx.Client(transport=make_transport(GENRE_RESPONSE, {}, seen_requests)) as client:
        adapter.fetch(client)

    anime_calls = [r for r in seen_requests if r.url.path == "/v4/anime"]
    assert anime_calls
    assert anime_calls[0].url.params.get("genres") == "62"


def make_anime_item(**overrides):
    item = {
        "mal_id": 12345,
        "type": "TV",
        "url": "https://myanimelist.net/anime/12345/Example",
        "titles": [
            {"type": "Default", "title": "Reijou wa Example"},
            {"type": "English", "title": "The Corrected Title"},
            {"type": "Japanese", "title": "例のアニメ"},
        ],
        "aired": {"from": "2025-04-05T00:00:00+00:00"},
        "status": "Currently Airing",
        "synopsis": "Two girls fall in love at a school for aristocrats.",
        "images": {"jpg": {"large_image_url": "https://cdn.myanimelist.net/large.jpg"}},
    }
    item.update(overrides)
    return item


def test_parse_prefers_the_english_title_and_maps_status_and_type():
    adapter = MyAnimeListAdapter()
    payload = json.dumps({"data": [make_anime_item()]})

    [record] = adapter.parse(payload)

    assert record["title"] == "The Corrected Title"
    assert record["original_title"] == "例のアニメ"
    assert record["type"] == "Series"
    assert record["status"] == "Airing"
    assert record["year"] == 2025
    assert record["poster_url"] == "https://cdn.myanimelist.net/large.jpg"
    assert record["source_url"] == "https://myanimelist.net/anime/12345/Example"


def test_parse_maps_movie_type_correctly():
    adapter = MyAnimeListAdapter()
    payload = json.dumps({"data": [make_anime_item(type="Movie")]})

    [record] = adapter.parse(payload)
    assert record["type"] == "Movie"


def test_parse_skips_entries_mal_has_no_series_or_movie_mapping_for():
    adapter = MyAnimeListAdapter()
    payload = json.dumps({"data": [make_anime_item(type="Music")]})

    assert adapter.parse(payload) == []


def test_normalize_builds_a_valid_raw_crawl_item():
    adapter = MyAnimeListAdapter()
    payload = json.dumps({"data": [make_anime_item()]})
    [record] = adapter.parse(payload)

    item = adapter.normalize(record)

    assert item.title == "The Corrected Title"
    assert item.source_name == "MyAnimeList"
    assert item.type == "Series"
    assert item.status == "Airing"
