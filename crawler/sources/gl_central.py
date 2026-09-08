"""GL Central adapter.

Secondary GL catalog source used to cross-check titles found on GL
Archive (product spec section 18). Same caveat as gl_archive.py: the
selectors here are a starting structure, not yet verified against the
live site from this environment.
"""
from typing import Any

import httpx
from bs4 import BeautifulSoup

from ..config import CURRENT_YEAR
from ..models import RawCrawlItem
from .base import SourceAdapter


class GLCentralAdapter(SourceAdapter):
    name = "GL Central"
    base_url = "https://example-gl-central.invalid/catalog"  # placeholder until the real URL is confirmed

    def fetch(self, client: httpx.Client) -> list[str]:
        response = self._get(self.base_url, client)
        return [response.text]

    def parse(self, raw_payload: str) -> list[dict[str, Any]]:
        soup = BeautifulSoup(raw_payload, "lxml")
        records: list[dict[str, Any]] = []

        for card in soup.select(".title-card"):
            title_el = card.select_one(".title-card__name")
            if not title_el:
                continue
            records.append(
                {
                    "title": title_el.get_text(strip=True),
                    "type": "Movie" if "movie" in card.get("class", []) else "Series",
                    "year": card.get("data-year"),
                    "country": card.get("data-country"),
                    "poster_url": card.select_one("img")["src"] if card.select_one("img") else None,
                    "source_url": card.select_one("a")["href"] if card.select_one("a") else self.base_url,
                }
            )

        return records

    def normalize(self, record: dict[str, Any]) -> RawCrawlItem:
        year = int(record["year"]) if record.get("year") else None
        return RawCrawlItem(
            title=record["title"],
            type=record.get("type", "Series"),
            year=year or CURRENT_YEAR,
            country=record.get("country"),
            poster_url=record.get("poster_url"),
            source_url=record.get("source_url", self.base_url),
            source_name=self.name,
        )
