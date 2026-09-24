"""Admin -> Sources must be the only authority once the table has rows."""
from crawler.main import SOURCE_REGISTRY, load_enabled_sources


class FakeSources:
    def __init__(self, rows):
        self.rows = rows

    def table(self, _name):
        return self

    def select(self, *_a):
        return self

    def order(self, *_a):
        return self

    def execute(self):
        rows = self.rows

        class Result:
            data = rows

        return Result()


def names(pairs):
    return [adapter.name for adapter, _row in pairs]


def test_only_enabled_rows_run():
    rows = [
        {"id": "1", "name": "GL Archive", "enabled": False},
        {"id": "2", "name": "AniList", "enabled": True},
        {"id": "3", "name": "MyAnimeList", "enabled": False},
        {"id": "4", "name": "TMDB", "enabled": True},
    ]
    assert names(load_enabled_sources(FakeSources(rows))) == ["AniList", "TMDB"]


def test_all_rows_disabled_means_nothing_runs():
    rows = [{"id": "1", "name": "AniList", "enabled": False}, {"id": "2", "name": "TMDB", "enabled": False}]
    assert load_enabled_sources(FakeSources(rows)) == []


def test_empty_table_falls_back_to_every_adapter():
    assert len(load_enabled_sources(FakeSources([]))) == len(SOURCE_REGISTRY)


def test_no_database_runs_every_adapter():
    assert len(load_enabled_sources(None)) == len(SOURCE_REGISTRY)
