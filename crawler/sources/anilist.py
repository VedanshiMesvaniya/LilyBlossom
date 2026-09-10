"""AniList GraphQL adapter for Yuri / Girls' Love anime.

Fetches anime tagged with 'Yuri' from the public AniList GraphQL API.
"""
import json
from typing import Any

import httpx

from ..config import CURRENT_YEAR, MAX_RETRIES, REQUEST_TIMEOUT_SECONDS, USER_AGENT
from ..models import RawCrawlItem
from .base import SourceAdapter
from tenacity import retry, stop_after_attempt, wait_exponential

ANILIST_GRAPHQL_URL = "https://graphql.anilist.co"

YURI_QUERY = """
query ($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      hasNextPage
    }
    media(tag: "Yuri", type: ANIME, sort: POPULARITY_DESC) {
      id
      title {
        english
        romaji
        native
      }
      format
      status
      description
      startDate {
        year
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
    "NOT_YET_RELEASED": "Upcoming",
    "CANCELLED": "Cancelled",
}


class AniListAdapter(SourceAdapter):
    name = "AniList"
    base_url = ANILIST_GRAPHQL_URL

    @retry(stop=stop_after_attempt(MAX_RETRIES), wait=wait_exponential(multiplier=2), reraise=True)
    def _post(self, client: httpx.Client, query: str, variables: dict[str, Any]) -> dict[str, Any]:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        response = client.post(
            self.base_url,
            json={"query": query, "variables": variables},
            headers=headers,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return response.json()

    def fetch(self, client: httpx.Client) -> list[str]:
        # Fetch initial page (up to 50 entries)
        data = self._post(client, YURI_QUERY, {"page": 1, "perPage": 50})
        return [json.dumps(data)]

    def parse(self, raw_payload: str) -> list[dict[str, Any]]:
        data = json.loads(raw_payload)
        media_items = data.get("data", {}).get("Page", {}).get("media", [])
        records: list[dict[str, Any]] = []

        for item in media_items:
            title_obj = item.get("title") or {}
            title = title_obj.get("english") or title_obj.get("romaji") or title_obj.get("native")
            if not title:
                continue

            fmt = item.get("format") or "TV"
            title_type = "Movie" if fmt == "MOVIE" else "Series"

            status_code = item.get("status") or "FINISHED"
            status = STATUS_MAP.get(status_code, "Announced")

            start_date = item.get("startDate") or {}
            year = start_date.get("year")

            cover = item.get("coverImage") or {}
            poster_url = cover.get("extraLarge") or cover.get("large")

            anilist_id = item.get("id")

            records.append(
                {
                    "title": title,
                    "original_title": title_obj.get("native"),
                    "type": title_type,
                    "year": year,
                    "country": item.get("countryOfOrigin") or "JP",
                    "status": status,
                    "description": item.get("description"),
                    "poster_url": poster_url,
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
            country=record.get("country"),
            status=record.get("status", "Announced"),
            description=record.get("description"),
            poster_url=record.get("poster_url"),
            source_url=record.get("source_url", "https://anilist.co"),
            source_name=self.name,
            anilist_id=record.get("anilist_id"),
        )

