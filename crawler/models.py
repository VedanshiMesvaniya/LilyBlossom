"""Pydantic models shared across the crawler pipeline.

Every source adapter's parse() step must return a RawCrawlItem. Nothing
downstream (normalizer, deduplicator, database writer) accepts a raw
dict, so a malformed adapter fails loudly at the boundary instead of
corrupting the catalog.
"""
from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field, HttpUrl


TitleType = Literal["Series", "Movie"]
ReleaseStatus = Literal[
    "Announced", "In Production", "Upcoming", "Airing", "Completed", "Cancelled"
]
CrawlState = Literal["new", "existing", "updated", "duplicate", "uncertain", "error"]


class RawCrawlItem(BaseModel):
    """Standardized output of a source adapter's parse() + normalize()."""

    title: str
    original_title: Optional[str] = None
    type: TitleType
    year: Optional[int] = None
    release_date: Optional[date] = None
    country: Optional[str] = None
    language: Optional[str] = None
    status: ReleaseStatus = "Announced"
    episode_count: Optional[int] = None
    runtime_minutes: Optional[int] = None
    description: Optional[str] = None
    poster_url: Optional[HttpUrl] = None
    official_url: Optional[HttpUrl] = None
    source_url: HttpUrl
    source_name: str
    tmdb_id: Optional[str] = None
    anilist_id: Optional[str] = None
    imdb_id: Optional[str] = None


class NormalizedItem(RawCrawlItem):
    """A RawCrawlItem after normalizer.py has cleaned the title text."""

    normalized_title: str


class MatchResult(BaseModel):
    matched_title_id: Optional[str] = None
    confidence: float = Field(ge=0.0, le=1.0)
    state: CrawlState


class CrawlRunSummary(BaseModel):
    sources_checked: int = 0
    items_found: int = 0
    new_items: int = 0
    updated_items: int = 0
    duplicates: int = 0
    uncertain_items: int = 0
    errors: int = 0
