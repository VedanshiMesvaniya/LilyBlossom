"""Tests for crawling every region: one AniList query per country and
one TMDB pass per region, so no single big region fills every page."""
import json

import httpx
import pytest

from crawler.sources import anilist as anilist_module
from crawler.sources import tmdb as tmdb_module
from crawler.sources.anilist import AniListAdapter
from crawler.sources.tmdb import TMDBAdapter


@pytest.fixture(autouse=True)
def no_sleep(monkeypatch):
    monkeypatch.setattr(anilist_module.time, "sleep", lambda _s: None)
    monkeypatch.setattr(tmdb_module.time, "sleep", lambda _s: None)


def anilist_page(media_id, country):
    return {
        "data": {
            "Page": {
                "pageInfo": {"hasNextPage": False},
                "media": [
                    {
                        "id": media_id,
                        "title": {"english": f"T{media_id}", "romaji": None, "native": None},
                        "format": "TV",
                        "status": "FINISHED",
                        "countryOfOrigin": country,
                        "siteUrl": f"https://anilist.co/anime/{media_id}",
                    }
                ],
            }
        }
    }


def test_anilist_asks_once_per_country_with_the_country_filter(monkeypatch):
    monkeypatch.setattr(anilist_module, "ANILIST_COUNTRIES", ["JP", "CN", "KR"])
    seen = []

    def handler(request):
        body = json.loads(request.content)
        seen.append((body["variables"].get("country"), "countryOfOrigin: $country" in body["query"]))
        country = body["variables"]["country"]
        return httpx.Response(200, json=anilist_page({"JP": 1, "CN": 2, "KR": 3}[country], country))

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        items, errors = AniListAdapter().run(client)

    assert errors == []
    assert seen == [("JP", True), ("CN", True), ("KR", True)]
    assert {i.country for i in items} == {"JP", "CN", "KR"}


def test_anilist_one_country_failing_keeps_the_others(monkeypatch):
    monkeypatch.setattr(anilist_module, "ANILIST_COUNTRIES", ["JP", "CN"])

    def handler(request):
        country = json.loads(request.content)["variables"]["country"]
        if country == "CN":
            return httpx.Response(200, json={"data": None, "errors": [{"message": "boom"}]})
        return httpx.Response(200, json=anilist_page(1, "JP"))

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        items, errors = AniListAdapter().run(client)

    assert [i.country for i in items] == ["JP"]
    assert any("CN" in e for e in errors)


def tmdb_handler(seen_regions):
    def handler(request):
        path = request.url.path
        params = request.url.params
        if path == "/3/search/keyword":
            return httpx.Response(200, json={"results": [{"id": 1, "name": params["query"]}]})
        if path in ("/3/discover/tv", "/3/discover/movie"):
            region = params.get("with_origin_country")
            seen_regions.append((path, region))
            # Every pass returns show 11 (a duplicate), and Thailand adds show 12.
            results = [{"id": 11, "name": "Global Show"}]
            if region == "TH" and path == "/3/discover/tv":
                results.append({"id": 12, "name": "Thai Show"})
            return httpx.Response(200, json={"total_pages": 1, "results": results})
        if path == "/3/tv/11" or path == "/3/tv/12":
            return httpx.Response(200, json={"status": "Ended", "number_of_episodes": 8, "first_air_date": "2021-01-01"})
        return httpx.Response(404, json={})

    return handler


def test_tmdb_runs_a_pass_for_every_region_and_loads_each_title_once(monkeypatch):
    monkeypatch.setattr(tmdb_module, "TMDB_API_KEY", "test-key")
    monkeypatch.setattr(tmdb_module, "TMDB_REGIONS", ["TH", "KR"])
    seen = []

    with httpx.Client(transport=httpx.MockTransport(tmdb_handler(seen))) as client:
        items, errors = TMDBAdapter().run(client)

    assert errors == []
    tv_regions = [region for path, region in seen if path == "/3/discover/tv"]
    assert tv_regions == [None, "TH", "KR"]
    assert sorted(i.title for i in items) == ["Global Show", "Thai Show"]  # duplicates dropped


def test_tmdb_one_failing_region_keeps_the_others(monkeypatch):
    monkeypatch.setattr(tmdb_module, "TMDB_API_KEY", "test-key")
    monkeypatch.setattr(tmdb_module, "TMDB_REGIONS", ["TH"])
    inner = tmdb_handler([])

    def handler(request):
        if request.url.params.get("with_origin_country") == "TH":
            return httpx.Response(400, json={})
        return inner(request)

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        items, errors = TMDBAdapter().run(client)

    assert [i.title for i in items] == ["Global Show"]
    assert any("TH" in e for e in errors)


def test_unaired_show_falls_back_for_date_and_episode_count():
    payload = json.dumps(
        {
            "_type": "Series",
            "results": [
                {
                    "id": 5,
                    "name": "The Body",
                    "_detail": {
                        "status": "In Production",
                        "number_of_episodes": 0,
                        "first_air_date": "",
                        "next_episode_to_air": None,
                        "seasons": [{"season_number": 1, "name": "Season 1", "episode_count": 10, "air_date": "2026-11-05"}],
                        "original_language": "en",
                        "origin_country": ["US"],
                    },
                }
            ],
        }
    )
    record = TMDBAdapter().parse(payload)[0]
    assert record["release_date"] == "2026-11-05"
    assert record["episode_count"] == 10
    assert record["language"] == "en"
    assert record["year"] == 2026
