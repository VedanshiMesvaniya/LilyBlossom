"""TMDB adapter for Girls' Love (GL) live-action discovery and metadata enrichment.

Uses the official The Movie Database (TMDB) API to discover series and movies
tagged with GL/lesbian romance/yuri keywords (product spec section 30 and 90).
"""
import json
from typing import Any, Optional

import httpx

from ..config import CURRENT_YEAR, MAX_RETRIES, REQUEST_TIMEOUT_SECONDS, TMDB_API_KEY, USER_AGENT
from ..models import RawCrawlItem
from .base import SourceAdapter
from tenacity import retry, stop_after_attempt, wait_exponential

TMDB_BASE_URL = "https://api.themoviedb.org/3"

# Common TMDB keyword IDs:
# 9840: lesbian romance, 158718: yuri, 258284: girls' love, 261493: gl
GL_KEYWORD_IDS = "9840|158718|258284|261493"


class TMDBAdapter(SourceAdapter):
    name = "TMDB"
    base_url = TMDB_BASE_URL

    def _get_auth(self) -> tuple[dict[str, str], dict[str, str]]:
        headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
        params: dict[str, str] = {}
        if TMDB_API_KEY:
            if TMDB_API_KEY.startswith("eyJ"):
                headers["Authorization"] = f"Bearer {TMDB_API_KEY}"
            else:
                params["api_key"] = TMDB_API_KEY
        return headers, params

    @retry(stop=stop_after_attempt(MAX_RETRIES), wait=wait_exponential(multiplier=2), reraise=True)
    def _fetch_endpoint(self, client: httpx.Client, endpoint: str, extra_params: dict[str, Any]) -> dict[str, Any]:
        headers, params = self._get_auth()
        params.update(extra_params)
        response = client.get(
            f"{self.base_url}{endpoint}",
            headers=headers,
            params=params,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return response.json()

    def fetch(self, client: httpx.Client) -> list[str]:
        if not TMDB_API_KEY:
            # If no API key is provided, return empty without raising
            return []

        payloads = []
        # Discover GL TV series
        tv_data = self._fetch_endpoint(
            client,
            "/discover/tv",
            {"with_keywords": GL_KEYWORD_IDS, "sort_by": "popularity.desc"},
        )
        tv_data["_type"] = "Series"
        payloads.append(json.dumps(tv_data))

        # Discover GL Movies
        movie_data = self._fetch_endpoint(
            client,
            "/discover/movie",
            {"with_keywords": GL_KEYWORD_IDS, "sort_by": "popularity.desc"},
        )
        movie_data["_type"] = "Movie"
        payloads.append(json.dumps(movie_data))

        return payloads

    def parse(self, raw_payload: str) -> list[dict[str, Any]]:
        data = json.loads(raw_payload)
        item_type = data.get("_type", "Series")
        results = data.get("results", [])
        records: list[dict[str, Any]] = []

        for item in results:
            title = item.get("name") if item_type == "Series" else item.get("title")
            original_title = item.get("original_name") if item_type == "Series" else item.get("original_title")
            if not title:
                continue

            date_str = item.get("first_air_date") if item_type == "Series" else item.get("release_date")
            year = int(date_str[:4]) if date_str and len(date_str) >= 4 and date_str[:4].isdigit() else None

            origin_countries = item.get("origin_country") or []
            country = origin_countries[0] if origin_countries else None

            poster_path = item.get("poster_path")
            poster_url = f"https://image.tmdb.org/t/p/w500{poster_path}" if poster_path else None

            tmdb_id = item.get("id")
            path_type = "tv" if item_type == "Series" else "movie"
            source_url = f"https://www.themoviedb.org/{path_type}/{tmdb_id}"

            records.append(
                {
                    "title": title,
                    "original_title": original_title,
                    "type": item_type,
                    "year": year,
                    "country": country,
                    "description": item.get("overview") or None,
                    "poster_url": poster_url,
                    "source_url": source_url,
                    "tmdb_id": str(tmdb_id) if tmdb_id is not None else None,
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
            description=record.get("description"),
            poster_url=record.get("poster_url"),
            source_url=record.get("source_url", "https://www.themoviedb.org"),
            source_name=self.name,
            tmdb_id=record.get("tmdb_id"),
        )


class TMDBEnricher:
    """Enriches already-discovered titles with TMDB metadata & poster."""

    name = "TMDB"

    def __init__(self) -> None:
        if not TMDB_API_KEY:
            raise RuntimeError("TMDB_API_KEY is not configured.")

    def search(self, client: httpx.Client, title: str, year: Optional[int]) -> Optional[dict[str, Any]]:
        headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
        params: dict[str, Any] = {"query": title}
        if TMDB_API_KEY.startswith("eyJ"):
            headers["Authorization"] = f"Bearer {TMDB_API_KEY}"
        else:
            params["api_key"] = TMDB_API_KEY
        if year:
            params["year"] = year

        response = client.get(f"{TMDB_BASE_URL}/search/multi", headers=headers, params=params, timeout=20)
        response.raise_for_status()
        results = response.json().get("results", [])
        return results[0] if results else None

    def enrich(self, client: httpx.Client, title: str, year: Optional[int]) -> dict[str, Any]:
        match = self.search(client, title, year)
        if not match:
            return {}

        poster_path = match.get("poster_path")
        return {
            "tmdb_id": str(match.get("id")),
            "description": match.get("overview") or None,
            "poster_url": f"https://image.tmdb.org/t/p/w500{poster_path}" if poster_path else None,
        }
