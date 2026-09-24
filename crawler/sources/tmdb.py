"""TMDB adapter for Girls' Love (GL) live-action discovery and metadata enrichment.

Uses the official The Movie Database (TMDB) API to discover series and movies
tagged with GL/lesbian romance/yuri keywords (product spec section 30 and 90).
"""
import json
import time
from datetime import date
from typing import Any, Optional

import httpx

from ..config import CURRENT_YEAR, MAX_RETRIES, MAX_TMDB_PAGES, REQUEST_TIMEOUT_SECONDS, TMDB_API_KEY, USER_AGENT
from ..models import RawCrawlItem
from .base import SourceAdapter
from tenacity import retry, stop_after_attempt, wait_exponential

TMDB_BASE_URL = "https://api.themoviedb.org/3"

# The old hardcoded list here (9840, 158718, 258284, 261493) was
# checked against the live TMDB site and turned out to be wrong.
# TMDB's real "yuri" keyword id is 214564 and "lesbian" is 264386,
# and "girls' love" / "gl" do not exist as TMDB keywords at all, so
# there is nothing correct to hardcode for them. TMDB keyword ids
# also are not guaranteed to stay the same forever. So instead of
# trusting a fixed id list, _resolve_keyword_ids() below looks the
# current id up by name through TMDB's own /search/keyword endpoint
# every time the adapter runs, and keeps it only for that one run.
GL_KEYWORD_NAMES = ["yuri", "lesbian"]


def tmdb_release_status(item_type: str, detail: dict[str, Any], release_date: Optional[str], today: Optional[date] = None) -> str:
    """Maps TMDB's own status text onto the catalog's release statuses.

    /discover never returns a status, so before this every TMDB title
    was stored as "Announced", which also left "Currently Airing"
    empty. A release date in the future always means Upcoming, unless
    TMDB says the title was canceled.
    """
    today = today or date.today()
    tmdb_status = (detail.get("status") or "").strip()

    if tmdb_status == "Canceled":
        return "Cancelled"

    if release_date:
        try:
            if date.fromisoformat(release_date) > today:
                return "Upcoming"
        except ValueError:
            pass

    if item_type == "Series":
        if tmdb_status == "Returning Series":
            return "Airing"
        if tmdb_status == "Ended":
            return "Completed"
        if tmdb_status in ("In Production", "Pilot"):
            return "In Production"
        if tmdb_status == "Planned":
            return "Announced"
    else:
        if tmdb_status == "Released":
            return "Completed"
        if tmdb_status in ("Post Production", "In Production"):
            return "In Production"
        if tmdb_status in ("Planned", "Rumored"):
            return "Announced"

    return "Announced"


def _clean_date(value: Any) -> Optional[str]:
    """TMDB sends an empty string for an unknown date. Keep only a real YYYY-MM-DD."""
    if isinstance(value, str) and len(value) == 10:
        try:
            date.fromisoformat(value)
            return value
        except ValueError:
            return None
    return None


class TMDBAdapter(SourceAdapter):
    name = "TMDB"
    base_url = TMDB_BASE_URL

    def __init__(self) -> None:
        self._keyword_ids_cache: Optional[str] = None
        self.detail_failures = 0

    def _fetch_detail(self, client: httpx.Client, item_type: str, tmdb_id: Any) -> tuple[Optional[dict[str, Any]], bool]:
        """Loads /tv/{id} or /movie/{id}. Returns (detail, failed).

        /discover only returns a short summary: no episode count, no
        seasons, no runtime, no status, and no country for movies. The
        detail call has all of them. A 404 just means TMDB has no page
        (not a failure). Anything else that keeps failing is counted in
        detail_failures and reported, and the title is still saved
        with the discover fields it already has.
        """
        path = f"/tv/{tmdb_id}" if item_type == "Series" else f"/movie/{tmdb_id}"
        headers, params = self._get_auth()
        if item_type == "Series":
            params["append_to_response"] = "external_ids"

        for attempt in range(1, MAX_RETRIES + 1):
            try:
                response = client.get(
                    f"{self.base_url}{path}", headers=headers, params=params, timeout=REQUEST_TIMEOUT_SECONDS
                )
            except httpx.TransportError:
                time.sleep(attempt)
                continue

            if response.status_code == 404:
                return None, False
            if response.status_code == 429 or response.status_code >= 500:
                try:
                    wait = float(response.headers.get("Retry-After", attempt * 2))
                except ValueError:
                    wait = attempt * 2
                time.sleep(min(wait, 10))
                continue
            if response.status_code >= 400:
                return None, True
            try:
                return response.json(), False
            except ValueError:
                return None, True

        return None, True

    def _add_details(self, client: httpx.Client, payloads: list[str]) -> list[str]:
        enriched: list[str] = []
        for raw in payloads:
            data = json.loads(raw)
            item_type = data.get("_type", "Series")
            for result in data.get("results", []):
                if result.get("id") is None:
                    continue
                detail, failed = self._fetch_detail(client, item_type, result["id"])
                if failed:
                    self.detail_failures += 1
                if detail:
                    result["_detail"] = detail
            enriched.append(json.dumps(data))
        return enriched

    def run(self, client: httpx.Client):  # type: ignore[override]
        self.detail_failures = 0
        items, errors = super().run(client)
        if self.detail_failures:
            errors.append(
                f"TMDB: could not load full details for {self.detail_failures} title(s), "
                "so some of their fields may be blank"
            )
        return items, errors

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

    def _resolve_keyword_ids(self, client: httpx.Client) -> str:
        """Looks up the current TMDB keyword id for each name in
        GL_KEYWORD_NAMES through /search/keyword, and joins whatever
        is found into the pipe separated form /discover expects. A
        name TMDB has no keyword for is skipped instead of failing
        the whole crawl. Cached for the life of one adapter instance
        so a multi page crawl only does this lookup once."""
        if self._keyword_ids_cache is not None:
            return self._keyword_ids_cache

        found_ids: list[str] = []
        for keyword_name in GL_KEYWORD_NAMES:
            data = self._fetch_endpoint(client, "/search/keyword", {"query": keyword_name})
            results = data.get("results", [])
            exact_match = next((r for r in results if r.get("name", "").lower() == keyword_name), None)
            match = exact_match or (results[0] if results else None)
            if match and match.get("id") is not None:
                found_ids.append(str(match["id"]))

        self._keyword_ids_cache = "|".join(found_ids)
        return self._keyword_ids_cache

    def _fetch_all_pages(self, client: httpx.Client, endpoint: str, item_type: str, keyword_ids: str) -> list[str]:
        """Pages through one /discover endpoint up to MAX_TMDB_PAGES,
        stopping early once TMDB reports there are no more pages left.
        Without this, only the first ~20 results were ever collected
        regardless of how many GL titles TMDB actually has."""
        payloads = []
        page = 1
        total_pages = 1

        while page <= min(total_pages, MAX_TMDB_PAGES):
            data = self._fetch_endpoint(
                client,
                endpoint,
                {"with_keywords": keyword_ids, "sort_by": "popularity.desc", "page": page},
            )
            data["_type"] = item_type
            payloads.append(json.dumps(data))

            total_pages = data.get("total_pages") or 1
            page += 1

        return payloads

    def fetch(self, client: httpx.Client) -> list[str]:
        if not TMDB_API_KEY:
            # If no API key is provided, return empty without raising
            return []

        keyword_ids = self._resolve_keyword_ids(client)
        if not keyword_ids:
            # TMDB returned no matching keyword for any name we asked
            # about, so there is nothing safe to discover against.
            return []

        payloads = []
        payloads.extend(self._fetch_all_pages(client, "/discover/tv", "Series", keyword_ids))
        payloads.extend(self._fetch_all_pages(client, "/discover/movie", "Movie", keyword_ids))
        return self._add_details(client, payloads)

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

            detail = item.get("_detail") or {}
            has_detail = bool(detail)

            if item_type == "Series":
                date_str = _clean_date(detail.get("first_air_date")) or _clean_date(item.get("first_air_date"))
                countries = detail.get("origin_country") or item.get("origin_country") or []
                country = countries[0] if countries else None
                episode_count = detail.get("number_of_episodes") or None
                runtime = None
                imdb_id = (detail.get("external_ids") or {}).get("imdb_id") or None
                seasons = [
                    {
                        "season_number": season["season_number"],
                        "name": season.get("name") or None,
                        "episode_count": season.get("episode_count"),
                        "air_date": _clean_date(season.get("air_date")),
                    }
                    for season in detail.get("seasons") or []
                    if isinstance(season.get("season_number"), int) and season["season_number"] >= 1
                ]
            else:
                date_str = _clean_date(detail.get("release_date")) or _clean_date(item.get("release_date"))
                production = detail.get("production_countries") or []
                countries = detail.get("origin_country") or item.get("origin_country") or []
                country = (
                    countries[0]
                    if countries
                    else (production[0].get("iso_3166_1") if production else None)
                )
                episode_count = None
                runtime = detail.get("runtime") or None
                imdb_id = detail.get("imdb_id") or None
                seasons = []

            year = int(date_str[:4]) if date_str else None

            poster_path = item.get("poster_path")
            poster_url = f"https://image.tmdb.org/t/p/w500{poster_path}" if poster_path else None

            tmdb_id = item.get("id")
            path_type = "tv" if item_type == "Series" else "movie"
            source_url = f"https://www.themoviedb.org/{path_type}/{tmdb_id}"

            homepage = detail.get("homepage")
            records.append(
                {
                    "title": title,
                    "original_title": original_title,
                    "type": item_type,
                    "year": year,
                    "release_date": date_str,
                    "country": country,
                    "language": detail.get("original_language") or item.get("original_language") or None,
                    "status": tmdb_release_status(item_type, detail, date_str) if has_detail else None,
                    "episode_count": episode_count,
                    "runtime_minutes": runtime,
                    "description": detail.get("overview") or item.get("overview") or None,
                    "official_url": homepage if isinstance(homepage, str) and homepage.startswith("http") else None,
                    "poster_url": poster_url,
                    "source_url": source_url,
                    "tmdb_id": str(tmdb_id) if tmdb_id is not None else None,
                    "imdb_id": imdb_id,
                    "seasons": seasons,
                }
            )

        return records

    def normalize(self, record: dict[str, Any]) -> RawCrawlItem:
        year = int(record["year"]) if record.get("year") else None
        fields: dict[str, Any] = {}
        if record.get("status"):
            fields["status"] = record["status"]
        return RawCrawlItem(
            title=record["title"],
            original_title=record.get("original_title"),
            type=record.get("type", "Series"),
            year=year,
            release_date=record.get("release_date"),
            country=record.get("country"),
            language=record.get("language"),
            episode_count=record.get("episode_count"),
            runtime_minutes=record.get("runtime_minutes"),
            description=record.get("description"),
            official_url=record.get("official_url"),
            poster_url=record.get("poster_url"),
            source_url=record.get("source_url", "https://www.themoviedb.org"),
            source_name=self.name,
            tmdb_id=record.get("tmdb_id"),
            imdb_id=record.get("imdb_id"),
            seasons=record.get("seasons") or [],
            **fields,
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
