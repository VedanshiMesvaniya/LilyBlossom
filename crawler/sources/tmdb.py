"""TMDB adapter: metadata/poster enrichment only, never the primary GL
classification source (product spec section 30 and 90).

Uses the official TMDB API rather than scraping, since TMDB provides
one. TMDB attribution is required wherever TMDB-sourced data or images
are shown; see docs/CRAWLER.md, "TMDB attribution".
"""
from typing import Any, Optional

import httpx

from ..config import TMDB_API_KEY

TMDB_BASE_URL = "https://api.themoviedb.org/3"


class TMDBEnricher:
    """Not a SourceAdapter: TMDB never creates new catalog rows on its
    own, it only fills in poster_url/description/etc. for a title the
    GL-specific adapters already discovered."""

    name = "TMDB"

    def __init__(self) -> None:
        if not TMDB_API_KEY:
            raise RuntimeError("TMDB_API_KEY is not configured.")

    def search(self, client: httpx.Client, title: str, year: Optional[int]) -> Optional[dict[str, Any]]:
        params = {"api_key": TMDB_API_KEY, "query": title}
        if year:
            params["year"] = year

        response = client.get(f"{TMDB_BASE_URL}/search/multi", params=params, timeout=20)
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
