"""Tests for the crawler's titles upsert path (crawler/main.py).

Uses a small in-memory fake instead of a real Supabase client, since
the point of these tests is the upsert *logic* (new vs updated vs
locked vs uncertain), not the Supabase Python client itself.
"""
from crawler.main import _upsert_item, build_title_fields, generate_unique_slug
from crawler.models import RawCrawlItem


class FakeQuery:
    def __init__(self, table, op, filters=None, payload=None):
        self.table = table
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

    def single(self):
        return self

    def maybe_single(self):
        return self

    def execute(self):
        return self.table.db._run(self)


class FakeResult:
    def __init__(self, data):
        self.data = data


class FakeTable:
    def __init__(self, db, name):
        self.db = db
        self.name = name

    def select(self, *_args, **_kwargs):
        return FakeQuery(self, "select")

    def insert(self, payload):
        return FakeQuery(self, "insert", payload=payload)

    def update(self, payload):
        return FakeQuery(self, "update", payload=payload)

    def upsert(self, payload, on_conflict=None):  # noqa: ARG002
        return FakeQuery(self, "upsert", payload=payload)


class FakeSupabase:
    """Enough of the Supabase client surface for one titles row, one
    crawl, and its title_sources / crawl_items / title_changes writes."""

    def __init__(self, titles=None):
        self.titles = {row["id"]: dict(row) for row in (titles or [])}
        self.title_sources = []
        self.crawl_items = []
        self.title_changes = []
        self._next_id = 1

    def table(self, name):
        return FakeTable(self, name)

    def _run(self, query):
        if query.table.name == "titles":
            if query.op == "select":
                if "canonical_slug" in query.filters:
                    match = [t for t in self.titles.values() if t.get("canonical_slug") == query.filters["canonical_slug"]]
                    return FakeResult(match)
                if "id" in query.filters:
                    row = self.titles.get(query.filters["id"])
                    return FakeResult(row)
            if query.op == "insert":
                new_id = f"title-{self._next_id}"
                self._next_id += 1
                row = {"id": new_id, **query.payload}
                self.titles[new_id] = row
                return FakeResult([row])
            if query.op == "update":
                row = self.titles[query.filters["id"]]
                row.update(query.payload)
                return FakeResult([row])
        if query.table.name == "title_sources" and query.op == "upsert":
            self.title_sources.append(query.payload)
            return FakeResult([query.payload])
        if query.table.name == "crawl_items" and query.op == "insert":
            self.crawl_items.append(query.payload)
            return FakeResult([query.payload])
        if query.table.name == "title_changes" and query.op == "insert":
            self.title_changes.append(query.payload)
            return FakeResult([query.payload])
        raise AssertionError(f"Unhandled fake query: {query.table.name} {query.op} {query.filters}")


def make_item(**overrides):
    defaults = dict(
        title="The Loyal Pin",
        type="Series",
        year=2024,
        source_url="https://example.invalid/x",
        source_name="GL Archive",
    )
    defaults.update(overrides)
    return RawCrawlItem(**defaults)


def test_new_item_creates_an_unpublished_lowercase_title():
    supabase = FakeSupabase()
    state = _upsert_item(
        item=make_item(),
        source_name="GL Archive",
        source_row={"id": "src-1"},
        supabase=supabase,
        candidates=[],
        used_slugs=set(),
        dry_run=False,
        run_id="run-1",
    )

    assert state == "new"
    [title] = supabase.titles.values()
    assert title["type"] == "series"  # not "Series": must match the DB check constraint
    assert title["is_published"] is False
    assert title["canonical_slug"] == "the-loyal-pin-2024"
    assert supabase.title_sources[0]["source_id"] == "src-1"
    assert supabase.crawl_items[0]["state"] == "new"


def test_matched_item_with_real_change_updates_and_logs_it():
    from crawler.deduplicator import CandidateTitle
    from crawler.normalizer import normalize_title

    supabase = FakeSupabase(
        titles=[
            {
                "id": "title-1",
                "canonical_title": "The Loyal Pin",
                "release_status": "Upcoming",
                "is_locked": False,
            }
        ]
    )
    candidates = [CandidateTitle(id="title-1", normalized_title=normalize_title("The Loyal Pin"), year=2024, country=None)]

    state = _upsert_item(
        item=make_item(status="Airing"),
        source_name="GL Archive",
        source_row={"id": "src-1"},
        supabase=supabase,
        candidates=candidates,
        used_slugs=set(),
        dry_run=False,
        run_id="run-1",
    )

    assert state == "updated"
    assert supabase.titles["title-1"]["release_status"] == "Airing"
    assert supabase.title_changes[0]["field"] == "release_status"


def test_locked_title_is_never_overwritten():
    from crawler.deduplicator import CandidateTitle
    from crawler.normalizer import normalize_title

    supabase = FakeSupabase(
        titles=[
            {
                "id": "title-1",
                "canonical_title": "The Loyal Pin",
                "release_status": "Upcoming",
                "is_locked": True,
            }
        ]
    )
    candidates = [CandidateTitle(id="title-1", normalized_title=normalize_title("The Loyal Pin"), year=2024, country=None)]

    state = _upsert_item(
        item=make_item(status="Airing"),
        source_name="GL Archive",
        source_row={"id": "src-1"},
        supabase=supabase,
        candidates=candidates,
        used_slugs=set(),
        dry_run=False,
        run_id="run-1",
    )

    assert state == "existing"
    assert supabase.titles["title-1"]["release_status"] == "Upcoming"  # untouched
    assert supabase.title_changes == []


def test_uncertain_match_never_writes_to_titles():
    from crawler.deduplicator import CandidateTitle

    supabase = FakeSupabase(titles=[{"id": "title-1", "canonical_title": "A Totally Different Show", "is_locked": False}])
    candidates = [CandidateTitle(id="title-1", normalized_title="a totally different show", year=2020, country=None)]

    state = _upsert_item(
        item=make_item(title="A Totally Different Series", year=2020),
        source_name="GL Archive",
        source_row={"id": "src-1"},
        supabase=supabase,
        candidates=candidates,
        used_slugs=set(),
        dry_run=False,
        run_id="run-1",
    )

    assert state == "uncertain"
    assert "release_status" not in supabase.titles["title-1"]


def test_slug_collision_gets_a_numeric_suffix():
    supabase = FakeSupabase(titles=[{"id": "title-1", "canonical_slug": "the-loyal-pin-2024"}])
    slug = generate_unique_slug(supabase, set(), "The Loyal Pin", 2024)
    assert slug == "the-loyal-pin-2024-2"


def test_build_title_fields_lowercases_type_for_the_db_check_constraint():
    fields = build_title_fields(make_item(type="Movie"))
    assert fields["type"] == "movie"
