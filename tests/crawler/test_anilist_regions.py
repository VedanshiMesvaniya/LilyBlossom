"""Tests for the AniList adapter's handling of every region, format,
rate limit and error case (crawler/sources/anilist.py)."""
import json

import httpx

from crawler.sources import anilist as anilist_module
from crawler.sources.anilist import AniListAdapter


def media(media_id, fmt, country, **extra):
    base = {
        "id": media_id,
        "title": {"english": f"Title {media_id}", "romaji": None, "native": f"Native {media_id}"},
        "format": fmt,
        "status": "FINISHED",
        "description": "A story about two women.",
        "episodes": 12,
        "duration": 24,
        "startDate": {"year": 2020, "month": 4, "day": 9},
        "countryOfOrigin": country,
        "coverImage": {"large": "https://img.example/l.jpg", "extraLarge": "https://img.example/xl.jpg"},
        "siteUrl": f"https://anilist.co/anime/{media_id}",
    }
    base.update(extra)
    return base


def page(items, has_next=False):
    return {"data": {"Page": {"pageInfo": {"hasNextPage": has_next}, "media": items}}}


def no_sleep(monkeypatch):
    monkeypatch.setattr(anilist_module.time, "sleep", lambda _s: None)


def test_every_region_and_format_is_kept_with_its_country(monkeypatch):
    no_sleep(monkeypatch)
    items = [
        media(1, "TV", "JP"),
        media(2, "ONA", "CN"),
        media(3, "MOVIE", "KR"),
        media(4, "OVA", "TW"),
    ]

    def handler(request):
        return httpx.Response(200, json=page(items))

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        results, errors = AniListAdapter().run(client)

    assert errors == []
    assert {r.anilist_id: r.country for r in results} == {"1": "JP", "2": "CN", "3": "KR", "4": "TW"}
    assert {r.anilist_id: r.type for r in results} == {"1": "Series", "2": "Series", "3": "Movie", "4": "Series"}


def test_movie_gets_runtime_not_episodes_and_series_gets_episodes(monkeypatch):
    no_sleep(monkeypatch)
    payload = json.dumps(page([media(1, "MOVIE", "JP", episodes=1, duration=95), media(2, "TV", "JP")]))
    records = AniListAdapter().parse(payload)

    movie = next(r for r in records if r["anilist_id"] == "1")
    series = next(r for r in records if r["anilist_id"] == "2")
    assert movie["episode_count"] is None
    assert movie["runtime_minutes"] == 95
    assert series["episode_count"] == 12
    assert series["runtime_minutes"] is None


def test_release_date_needs_year_month_and_day():
    full = AniListAdapter().parse(json.dumps(page([media(1, "TV", "JP")])))[0]
    partial = AniListAdapter().parse(
        json.dumps(page([media(2, "TV", "JP", startDate={"year": 2026, "month": None, "day": None})]))
    )[0]
    assert full["release_date"] == "2020-04-09"
    assert partial["release_date"] is None
    assert partial["year"] == 2026


def test_missing_country_stays_unknown_instead_of_becoming_japan():
    record = AniListAdapter().parse(json.dumps(page([media(1, "TV", None)])))[0]
    assert record["country"] is None


def test_query_asks_for_plain_text_safe_global_results():
    query = anilist_module.YURI_QUERY
    assert 'tag: "Yuri"' in query
    assert "isAdult: false" in query
    assert "asHtml: false" in query
    assert "countryOfOrigin" in query
    assert "countryOfOrigin:" not in query  # no single country filter, every region is requested


def test_rate_limit_waits_for_retry_after_then_succeeds(monkeypatch):
    waits = []
    monkeypatch.setattr(anilist_module.time, "sleep", lambda seconds: waits.append(seconds))
    calls = {"count": 0}

    def handler(request):
        calls["count"] += 1
        if calls["count"] == 1:
            return httpx.Response(429, headers={"Retry-After": "7"}, json={})
        return httpx.Response(200, json=page([media(1, "TV", "JP")]))

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        payloads = AniListAdapter().fetch(client)

    assert len(payloads) == 1
    assert waits == [7.0]


def test_rate_limit_that_never_clears_is_reported_not_raised(monkeypatch):
    no_sleep(monkeypatch)

    def handler(request):
        return httpx.Response(429, headers={"Retry-After": "1"}, json={})

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        results, errors = AniListAdapter().run(client)

    assert results == []
    assert len(errors) == 1 and "fetch failed" in errors[0]


def test_graphql_errors_in_a_200_response_are_reported(monkeypatch):
    no_sleep(monkeypatch)

    def handler(request):
        return httpx.Response(200, json={"data": None, "errors": [{"message": "Bad query"}]})

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        results, errors = AniListAdapter().run(client)

    assert results == []
    assert "Bad query" in errors[0]


def test_a_body_that_is_not_json_is_reported(monkeypatch):
    no_sleep(monkeypatch)

    def handler(request):
        return httpx.Response(200, text="<html>maintenance</html>")

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        results, errors = AniListAdapter().run(client)

    assert results == []
    assert "fetch failed" in errors[0]
