"""GL Archive adapter (glarchive.net/catalog).

GL Archive already separates series/movies and states such as
on-air/in-production/completed, so it is treated as the highest
priority catalog source (product spec section 18).

NOTE ON SELECTORS: the CSS selectors below are a best-effort starting
point based on typical catalog-grid markup. This sandbox cannot reach
glarchive.net to confirm them (network access here is restricted to
package registries and GitHub). Before this adapter runs in production,
verify the selectors against the live page's actual HTML and adjust
them; do not assume they are correct as shipped.
"""
from typing import Any

import httpx
from bs4 import BeautifulSoup

from ..config import CURRENT_YEAR
from ..models import RawCrawlItem
from .base import SourceAdapter

STATUS_MAP = {
    "on-air": "Airing",
    "airing": "Airing",
    "in-production": "In Production",
    "upcoming": "Upcoming",
    "completed": "Completed",
    "announced": "Announced",
    "cancelled": "Cancelled",
}


class GLArchiveAdapter(SourceAdapter):
    name = "GL Archive"
    base_url = "https://glarchive.net/catalog/"

    def fetch(self, client: httpx.Client) -> list[str]:
        response = self._get(self.base_url, client)
        return [response.text]

    def parse(self, raw_payload: str) -> list[dict[str, Any]]:
        soup = BeautifulSoup(raw_payload, "lxml")
        records: list[dict[str, Any]] = []

        # TODO: confirm against live markup. Placeholder assumes each
        # catalog entry is a card with a data-status attribute.
        for card in soup.select("[data-title]"):
            records.append(
                {
                    "title": card.get("data-title", "").strip(),
                    "type": "Series" if card.get("data-type", "series") == "series" else "Movie",
                    "status": card.get("data-status", "announced").lower(),
                    "country": card.get("data-country"),
                    "year": card.get("data-year"),
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
            status=STATUS_MAP.get(record.get("status", "announced"), "Announced"),
            poster_url=record.get("poster_url"),
            source_url=record.get("source_url", self.base_url),
            source_name=self.name,
        )
