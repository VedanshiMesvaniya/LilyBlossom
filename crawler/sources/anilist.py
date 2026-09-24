"""AniList GraphQL adapter for Yuri / Girls' Love anime from every region.

AniList is the main global source. It is a free public GraphQL API
that needs no key. One query covers every country of origin, and each
result carries an ISO country code (countryOfOrigin), so Japanese
anime, Chinese donghua, Korean and other regional titles all arrive
through the same path and are stored with the right country.

What the query asks for:

- the "Yuri" tag, above a minimum tag rank (ANILIST_MIN_TAG_RANK), so
  titles that only barely touch the tag are left out
- anime only, formats TV, TV_SHORT, MOVIE, OVA and ONA (no music
  videos, no specials)
- no adult titles (isAdult: false), since the catalog is public
- plain text descriptions (asHtml: false), so no HTML tags end up in
  the catalog

Rate limits: AniList allows about 90 requests a minute and answers
429 with a Retry-After header when that is exceeded. _post() waits for
that header and tries again instead of failing the whole source.
"""
import json
import time
from typing import Any

import httpx

from ..config import ANILIST_MIN_TAG_RANK, MAX_ANILIST_PAGES, MAX_RETRIES, REQUEST_TIMEOUT_SECONDS
from ..models import RawCrawlItem
from .base import SourceAdapter

ANILIST_GRAPHQL_URL = "https://graphql.anilist.co"

YURI_QUERY = """
query ($page: Int, $perPage: Int, $minRank: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      hasNextPage
    }
    media(
      tag: "Yuri"
      minimumTagRank: $minRank
      type: ANIME
      format_in: [TV, TV_SHORT, MOVIE, OVA, ONA]
      isAdult: false
      sort: POPULARITY_DESC
    ) {
      id
      title {
        english
        romaji
        native
      }
      format
      status
      description(asHtml: false)
      episodes
      duration
      startDate {
        year
        month
        day
      }
      countryOfOrigin
      coverImage {
        large
        extraLarge
      }
      siteUrl
    }
  }
}
"""

STATUS_MAP = {
    "FINISHED": "Completed",
    "RELEASING": "Airing",
    "HIATUS": "Airing",
    "NOT_YET_RELEASED": "Upcoming",
    "CANCELLED": "Cancelled",
}

# Longest wait honored for one Retry-After header, in seconds. AniList
# uses at most about a minute; anything longer is treated as a failure.
MAX_RETRY_AFTER_SECONDS = 65

# The earlier version of this adapter already sent a browser style
# User-Agent, so that is kept as is rather than risking a new block.
ANILIST_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


class AniListError(Exception):
    """AniList answered, but with a GraphQL error or an unusable body."""


class AniListAdapter(SourceAdapter):
    name = "AniList"
    base_url = ANILIST_GRAPHQL_URL

    # Pause between pages, to stay under AniList's 90 requests a minute.
    page_delay_seconds = 0.8

    def _post(self, client: httpx.Client, query: str, variables: dict[str, Any]) -> dict[str, Any]:
        headers = {
            "User-Agent": ANILIST_USER_AGENT,
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        last_error: Exception | None = None

        for attempt in range(1, MAX_RETRIES + 1):
            try:
                response = client.post(
                    self.base_url,
                    json={"query": query, "variables": variables},
                    headers=headers,
                    timeout=REQUEST_TIMEOUT_SECONDS,
                )
            except httpx.TransportError as exc:
                last_error = exc
                time.sleep(2 * attempt)
                continue

            if response.status_code == 429:
                retry_after = _parse_retry_after(response.headers.get("Retry-After"))
                last_error = httpx.HTTPStatusError(
                    "AniList rate limit (429)", request=response.request, response=response
                )
                if attempt < MAX_RETRIES:
                    time.sleep(retry_after)
                continue

            if response.status_code >= 500:
                last_error = httpx.HTTPStatusError(
                    f"AniList server error ({response.status_code})",
                    request=response.request,
                    response=response,
                )
                time.sleep(2 * attempt)
                continue

            response.raise_for_status()

            try:
                body = response.json()
            except ValueError as exc:
                raise AniListError(f"AniList returned a body that is not JSON: {exc}") from exc

            if body.get("errors"):
                first = body["errors"][0]
                raise AniListError(f"AniList GraphQL error: {first.get('message', first)}")
            return body

        assert last_error is not None
        raise last_error

    def fetch(self, client: httpx.Client) -> list[str]:
        payloads = []
        page = 1
        has_next_page = True

        while has_next_page and page <= MAX_ANILIST_PAGES:
            if page > 1:
                time.sleep(self.page_delay_seconds)
            data = self._post(
                client,
                YURI_QUERY,
                {"page": page, "perPage": 50, "minRank": ANILIST_MIN_TAG_RANK},
            )
            payloads.append(json.dumps(data))
            has_next_page = bool(data.get("data", {}).get("Page", {}).get("pageInfo", {}).get("hasNextPage"))
            page += 1

        return payloads

    def parse(self, raw_payload: str) -> list[dict[str, Any]]:
        data = json.loads(raw_payload)
        media_items = ((data.get("data") or {}).get("Page") or {}).get("media") or []
        records: list[dict[str, Any]] = []

        for item in media_items:
            title_obj = item.get("title") or {}
            title = title_obj.get("english") or title_obj.get("romaji") or title_obj.get("native")
            if not title:
                continue

            is_movie = item.get("format") == "MOVIE"

            start_date = item.get("startDate") or {}
            year = start_date.get("year")
            release_date = None
            if year and start_date.get("month") and start_date.get("day"):
                release_date = f"{year:04d}-{start_date['month']:02d}-{start_date['day']:02d}"

            cover = item.get("coverImage") or {}
            anilist_id = item.get("id")
            country = (item.get("countryOfOrigin") or "").strip().upper() or None

            records.append(
                {
                    "title": title,
                    "original_title": title_obj.get("native"),
                    "type": "Movie" if is_movie else "Series",
                    "year": year,
                    "release_date": release_date,
                    "country": country,
                    "status": STATUS_MAP.get(item.get("status") or "", "Announced"),
                    "description": (item.get("description") or "").strip() or None,
                    "episode_count": None if is_movie else item.get("episodes"),
                    "runtime_minutes": item.get("duration") if is_movie else None,
                    "poster_url": cover.get("extraLarge") or cover.get("large"),
                    "source_url": item.get("siteUrl") or f"https://anilist.co/anime/{anilist_id}",
                    "anilist_id": str(anilist_id) if anilist_id is not None else None,
                }
            )

        return records

    def normalize(self, record: dict[str, Any]) -> RawCrawlItem:
        year = int(record["year"]) if record.get("year") else None
        return RawCrawlItem(
            title=record["title"],
            original_title=record.get("original_title"),
            type=record.get("type", "Series"),
            year=year,
            release_date=record.get("release_date"),
            country=record.get("country"),
            status=record.get("status", "Announced"),
            description=record.get("description"),
            episode_count=record.get("episode_count"),
            runtime_minutes=record.get("runtime_minutes"),
            poster_url=record.get("poster_url"),
            source_url=record.get("source_url", "https://anilist.co"),
            source_name=self.name,
            anilist_id=record.get("anilist_id"),
        )


def _parse_retry_after(value: str | None) -> float:
    """Seconds to wait for a Retry-After header. Falls back to 30 when
    the header is missing or not a number, and never waits longer than
    MAX_RETRY_AFTER_SECONDS."""
    try:
        seconds = float(value) if value is not None else 30.0
    except ValueError:
        seconds = 30.0
    return max(1.0, min(seconds, MAX_RETRY_AFTER_SECONDS))
