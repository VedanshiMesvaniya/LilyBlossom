"""MyAnimeList adapter, via Jikan (api.jikan.moe), a free, open source,
keyless REST API that mirrors MyAnimeList's public pages.

Covers GL/Yuri anime series and movies from any country of origin MAL
catalogs (Japanese, Chinese donghua, Korean, etc.), not just Japan,
since MAL's own genre tagging is not country specific.

Verified with live requests before writing this: api.jikan.moe is a
real, currently working, free API (no key, no signup), MIT licensed,
with a published rate limit (60 requests/minute, 3/second).

Found after adding this, and not caught in the first check: Jikan's
own project pages (its GitHub repos and API listings) state that
using the API "for the sake of populating data/making your own
database" breaches MyAnimeList's Terms of Service, which is exactly
what this adapter does. This source is disabled by default in the
database (supabase/migrations/017_disable_myanimelist_pending_tos_decision.sql)
until someone decides whether that risk is acceptable. See
docs/CRAWLER.md.
"""
import json
import time
from typing import Any, Optional

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from ..config import (
    MAX_JIKAN_PAGES,
    MAX_RETRIES,
    REQUEST_DELAY_SECONDS,
    REQUEST_TIMEOUT_SECONDS,
    USER_AGENT,
)
from ..models import RawCrawlItem
from .base import SourceAdapter

JIKAN_BASE_URL = "https://api.jikan.moe/v4"

# MAL renamed its "Yuri" genre to "Girls Love" in 2022. Both names are
# checked here, by name, through /genres/anime, instead of hardcoding
# a numeric id: a MAL genre id can drift or be misremembered exactly
# like TMDB's keyword ids did (see crawler/sources/tmdb.py), so this
# looks the current id up at the start of each run instead.
GENRE_NAMES = {"girls love", "yuri"}

# MAL's own `type` field covers more than this project's two-value
# titles.type ('movie'/'series'). Everything with a real episode
# structure maps onto Series; anything not in this map (Music videos,
# mainly) is skipped, since it is not a series or a movie.
TYPE_MAP = {
    "TV": "Series",
    "Movie": "Movie",
    "OVA": "Series",
    "ONA": "Series",
    "Special": "Series",
}

STATUS_MAP = {
    "Finished Airing": "Completed",
    "Currently Airing": "Airing",
    "Not yet aired": "Upcoming",
}


class MyAnimeListAdapter(SourceAdapter):
    name = "MyAnimeList"
    base_url = JIKAN_BASE_URL

    def __init__(self) -> None:
        self._genre_id_cache: Optional[int] = None

    @retry(stop=stop_after_attempt(MAX_RETRIES), wait=wait_exponential(multiplier=2), reraise=True)
    def _get(self, client: httpx.Client, path: str, params: dict[str, Any]) -> dict[str, Any]:
        headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
        response = client.get(
            f"{self.base_url}{path}", headers=headers, params=params, timeout=REQUEST_TIMEOUT_SECONDS
        )
        response.raise_for_status()
        return response.json()

    def _resolve_genre_id(self, client: httpx.Client) -> Optional[int]:
        """Looks up the current numeric id for MAL's Girls Love (or
        Yuri) genre through /genres/anime, instead of trusting a
        hardcoded id that could be wrong or go stale. Cached for the
        life of one adapter instance, so a multi page crawl only does
        this lookup once. Returns None if MAL has neither genre right
        now, so fetch() can safely return nothing rather than crawl
        an unrelated, unfiltered genre."""
        if self._genre_id_cache is not None:
            return self._genre_id_cache

        data = self._get(client, "/genres/anime", {})
        for genre in data.get("data", []):
            if genre.get("name", "").lower() in GENRE_NAMES:
                self._genre_id_cache = genre["mal_id"]
                return self._genre_id_cache

        return None

    def fetch(self, client: httpx.Client) -> list[str]:
        genre_id = self._resolve_genre_id(client)
        if genre_id is None:
            return []

        payloads = []
        page = 1
        has_next_page = True

        while has_next_page and page <= MAX_JIKAN_PAGES:
            data = self._get(
                client,
                "/anime",
                {"genres": genre_id, "order_by": "popularity", "sort": "asc", "page": page},
            )
            payloads.append(json.dumps(data))
            has_next_page = bool(data.get("pagination", {}).get("has_next_page"))
            page += 1
            if has_next_page:
                # Jikan is free, keyless, and community run, with a
                # published rate limit of 3 requests/second. Sleeping
                # between pages is being a reasonable guest on a free
                # shared service, not just avoiding an error response.
                time.sleep(REQUEST_DELAY_SECONDS)

        return payloads

    def parse(self, raw_payload: str) -> list[dict[str, Any]]:
        data = json.loads(raw_payload)
        records: list[dict[str, Any]] = []

        for item in data.get("data", []):
            title_type = TYPE_MAP.get(item.get("type"))
            if title_type is None:
                continue  # Music and anything else MAL has: not a series or a movie

            titles = item.get("titles") or []
            title = (
                next((t["title"] for t in titles if t.get("type") == "English"), None)
                or next((t["title"] for t in titles if t.get("type") == "Default"), None)
                or item.get("title")
            )
            if not title:
                continue
            original_title = next((t["title"] for t in titles if t.get("type") == "Japanese"), None)

            aired = item.get("aired") or {}
            year = int(aired["from"][:4]) if aired.get("from") else item.get("year")

            images = (item.get("images") or {}).get("jpg") or {}
            poster_url = images.get("large_image_url") or images.get("image_url")

            mal_id = item.get("mal_id")

            records.append(
                {
                    "title": title,
                    "original_title": original_title,
                    "type": title_type,
                    "year": year,
                    "status": STATUS_MAP.get(item.get("status"), "Announced"),
                    "description": item.get("synopsis"),
                    "poster_url": poster_url,
                    "source_url": item.get("url") or (f"https://myanimelist.net/anime/{mal_id}" if mal_id else None),
                }
            )

        return records

    def normalize(self, record: dict[str, Any]) -> RawCrawlItem:
        return RawCrawlItem(
            title=record["title"],
            original_title=record.get("original_title"),
            type=record.get("type", "Series"),
            year=record.get("year"),
            status=record.get("status", "Announced"),
            description=record.get("description"),
            poster_url=record.get("poster_url"),
            source_url=record.get("source_url") or "https://myanimelist.net",
            source_name=self.name,
        )
