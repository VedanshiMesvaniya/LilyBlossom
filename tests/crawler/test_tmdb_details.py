"""Tests for TMDB detail enrichment (crawler/sources/tmdb.py).

/discover only gives a short summary, so episode counts, seasons,
runtime, status, language and movie countries came back empty. The
adapter now loads /tv/{id} and /movie/{id} for each result.
"""
from datetime import date

import httpx

from crawler.main import save_seasons
from crawler.models import RawCrawlItem
from crawler.sources import tmdb as tmdb_module
from crawler.sources.tmdb import TMDBAdapter, tmdb_release_status

TV_DETAIL = {
    "id": 11,
    "status": "Ended",
    "number_of_episodes": 24,
    "first_air_date": "2020-05-01",
    "origin_country": ["TH"],
    "original_language": "th",
    "homepage": "https://example.com/show",
    "external_ids": {"imdb_id": "tt1234567"},
    "seasons": [
        {"season_number": 0, "name": "Specials", "episode_count": 3, "air_date": "2020-01-01"},
        {"season_number": 1, "name": "Season 1", "episode_count": 12, "air_date": "2020-05-01"},
        {"season_number": 2, "name": "Season 2", "episode_count": 12, "air_date": ""},
    ],
}

MOVIE_DETAIL = {
    "id": 22,
    "status": "Released",
    "release_date": "2019-03-08",
    "runtime": 105,
    "production_countries": [{"iso_3166_1": "KR", "name": "South Korea"}],
    "original_language": "ko",
    "imdb_id": "tt7654321",
}


def make_client(tv_detail=TV_DETAIL, movie_detail=MOVIE_DETAIL, detail_status=200):
    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path == "/3/search/keyword":
            return httpx.Response(200, json={"results": [{"id": 1, "name": request.url.params["query"]}]})
        if path == "/3/discover/tv":
            return httpx.Response(200, json={"total_pages": 1, "results": [{"id": 11, "name": "Show", "first_air_date": "2020-05-01"}]})
        if path == "/3/discover/movie":
            return httpx.Response(200, json={"total_pages": 1, "results": [{"id": 22, "title": "Film"}]})
        if path == "/3/tv/11":
            return httpx.Response(detail_status, json=tv_detail)
        if path == "/3/movie/22":
            return httpx.Response(detail_status, json=movie_detail)
        return httpx.Response(404, json={})

    return httpx.Client(transport=httpx.MockTransport(handler))


def run_adapter(monkeypatch, **kwargs):
    monkeypatch.setattr(tmdb_module, "TMDB_API_KEY", "test-key")
    monkeypatch.setattr(tmdb_module.time, "sleep", lambda _s: None)
    adapter = TMDBAdapter()
    with make_client(**kwargs) as client:
        items, errors = adapter.run(client)
    return {item.type: item for item in items}, errors


def test_series_gets_episodes_seasons_status_country_language_and_imdb(monkeypatch):
    items, errors = run_adapter(monkeypatch)
    series = items["Series"]

    assert errors == []
    assert series.episode_count == 24
    assert series.release_date == date(2020, 5, 1)
    assert series.status == "Completed"
    assert series.country == "TH"
    assert series.language == "th"
    assert series.imdb_id == "tt1234567"
    assert str(series.official_url) == "https://example.com/show"
    # Specials (season 0) are left out, and an empty air date becomes unknown.
    assert [(s.season_number, s.episode_count, s.air_date) for s in series.seasons] == [
        (1, 12, date(2020, 5, 1)),
        (2, 12, None),
    ]


def test_movie_gets_runtime_country_and_status_but_no_episodes(monkeypatch):
    items, _ = run_adapter(monkeypatch)
    movie = items["Movie"]

    assert movie.runtime_minutes == 105
    assert movie.episode_count is None
    assert movie.country == "KR"
    assert movie.language == "ko"
    assert movie.status == "Completed"
    assert movie.imdb_id == "tt7654321"


def test_status_mapping():
    today = date(2026, 9, 24)
    assert tmdb_release_status("Series", {"status": "Returning Series"}, "2025-01-01", today) == "Airing"
    assert tmdb_release_status("Series", {"status": "Ended"}, "2020-01-01", today) == "Completed"
    assert tmdb_release_status("Series", {"status": "Canceled"}, "2020-01-01", today) == "Cancelled"
    assert tmdb_release_status("Series", {"status": "Returning Series"}, "2027-01-01", today) == "Upcoming"
    assert tmdb_release_status("Movie", {"status": "Released"}, "2020-01-01", today) == "Completed"
    assert tmdb_release_status("Movie", {"status": "Post Production"}, None, today) == "In Production"
    assert tmdb_release_status("Movie", {"status": "Rumored"}, None, today) == "Announced"
    assert tmdb_release_status("Movie", {}, None, today) == "Announced"


def test_a_title_with_no_tmdb_page_is_kept_without_a_failure(monkeypatch):
    monkeypatch.setattr(tmdb_module, "TMDB_API_KEY", "test-key")

    def handler(request):
        if request.url.path == "/3/search/keyword":
            return httpx.Response(200, json={"results": [{"id": 1, "name": request.url.params["query"]}]})
        if request.url.path == "/3/discover/tv":
            return httpx.Response(200, json={"total_pages": 1, "results": [{"id": 11, "name": "Show", "first_air_date": "2020-05-01"}]})
        if request.url.path == "/3/discover/movie":
            return httpx.Response(200, json={"total_pages": 1, "results": []})
        return httpx.Response(404, json={})

    adapter = TMDBAdapter()
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        items, errors = adapter.run(client)

    assert errors == []
    assert items[0].title == "Show" and items[0].episode_count is None


def test_failing_details_are_reported_but_titles_are_still_saved(monkeypatch):
    items, errors = run_adapter(monkeypatch, detail_status=500)

    assert set(items) == {"Series", "Movie"}
    assert any("could not load full details for 2 title(s)" in e for e in errors)


class FakeSeasonTable:
    def __init__(self, fail=False):
        self.fail = fail
        self.rows = None
        self.conflict = None

    def table(self, name):
        assert name == "title_seasons"
        return self

    def upsert(self, rows, on_conflict=None):
        self.rows, self.conflict = rows, on_conflict
        return self

    def execute(self):
        if self.fail:
            raise RuntimeError('relation "title_seasons" does not exist')


def make_item_with_seasons():
    return RawCrawlItem(
        title="Show",
        type="Series",
        source_url="https://example.com/x",
        source_name="TMDB",
        seasons=[{"season_number": 1, "name": "Season 1", "episode_count": 12, "air_date": "2020-05-01"}],
    )


def test_save_seasons_upserts_one_row_per_season():
    db = FakeSeasonTable()
    save_seasons(db, "title-1", make_item_with_seasons())
    assert db.conflict == "title_id,season_number"
    assert db.rows[0]["title_id"] == "title-1"
    assert db.rows[0]["season_number"] == 1
    assert db.rows[0]["air_date"] == "2020-05-01"


def test_save_seasons_never_raises_when_the_table_is_missing():
    save_seasons(FakeSeasonTable(fail=True), "title-1", make_item_with_seasons())
