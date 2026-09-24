"""Tests for the fixes that stop a crawl from failing on every item:
country codes, the 1000 row read limit, and one source crashing."""
import httpx

from crawler.main import _fetch_all_rows, load_known_country_codes, sanitize_item_country
from crawler.models import RawCrawlItem
from crawler.sources.base import SourceAdapter


def make_item(country):
    return RawCrawlItem(
        title="Test", type="Series", country=country, source_url="https://example.com/x", source_name="Test"
    )


def test_known_country_is_kept_and_uppercased():
    unknown = set()
    item = sanitize_item_country(make_item("jp"), {"JP", "KR"}, unknown)
    assert item.country == "JP"
    assert unknown == set()


def test_unknown_country_is_dropped_instead_of_breaking_the_insert():
    unknown = set()
    item = sanitize_item_country(make_item("ZZ"), {"JP", "KR"}, unknown)
    assert item.country is None
    assert unknown == {"ZZ"}


def test_empty_countries_table_drops_every_country_so_crawl_still_works():
    unknown = set()
    item = sanitize_item_country(make_item("JP"), set(), unknown)
    assert item.country is None


def test_no_filtering_when_there_is_no_database():
    item = make_item("ZZ")
    assert sanitize_item_country(item, None, set()) is item


class FakePagedQuery:
    def __init__(self, rows):
        self.rows = rows
        self.bounds = None

    def range(self, start, end):
        self.bounds = (start, end)
        return self

    def execute(self):
        start, end = self.bounds

        class Result:
            data = self.rows[start : end + 1]

        return Result()


def test_reads_past_the_1000_row_limit():
    rows = [{"id": str(i)} for i in range(2500)]
    result = _fetch_all_rows(lambda: FakePagedQuery(rows))
    assert len(result) == 2500


def test_reads_exactly_one_full_page_then_stops():
    rows = [{"id": str(i)} for i in range(1000)]
    assert len(_fetch_all_rows(lambda: FakePagedQuery(rows))) == 1000


def test_load_known_country_codes_uppercases_and_pages():
    class Table:
        def select(self, *_a):
            return self

        def order(self, *_a):
            return FakePagedQuery([{"code": "jp"}, {"code": "KR"}])

    class Db:
        def table(self, _name):
            return Table()

    assert load_known_country_codes(Db()) == {"JP", "KR"}


class BrokenAdapter(SourceAdapter):
    name = "Broken"
    base_url = "https://example.com"

    def fetch(self, client):
        raise KeyError("unexpected shape")

    def parse(self, raw_payload):
        return []

    def normalize(self, record):
        raise NotImplementedError


def test_a_non_http_crash_in_one_source_is_reported_not_raised():
    with httpx.Client() as client:
        items, errors = BrokenAdapter().run(client)
    assert items == []
    assert "fetch failed" in errors[0]
