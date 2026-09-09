"""GL Archive adapter (glarchive.net/catalog).

GL Archive specifically catalogues Girls' Love (GL) and Yuri media across
series and movies, including release states such as on-air, in-production,
completed, upcoming, and announced (product spec section 18).
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

        for card in soup.select("a.ct-card"):
            href = card.get("href", "")
            title_el = card.select_one(".ct-name")
            title = title_el.get_text(strip=True) if title_el else ""
            if not title:
                continue

            meta_el = card.select_one(".ct-meta")
            meta_text = meta_el.get_text(strip=True) if meta_el else ""
            # Format: "2016 · Asian · Completed"
            parts = [p.strip() for p in meta_text.split("·")]
            year = int(parts[0]) if parts and parts[0].isdigit() else None

            img = card.select_one("img")
            poster_url = img["src"] if img and img.get("src") else None

            status_raw = card.get("data-status", "announced").lower()
            status = STATUS_MAP.get(status_raw, "Announced")

            iso = card.get("data-iso") or None
            is_series = href.startswith("/series/") or "/series/" in href

            source_url = (
                f"https://glarchive.net{href}"
                if href.startswith("/")
                else (href or self.base_url)
            )

            records.append(
                {
                    "title": title,
                    "type": "Series" if is_series else "Movie",
                    "status": status,
                    "country": iso,
                    "year": year,
                    "poster_url": poster_url,
                    "source_url": source_url,
                }
            )

        return records

    def normalize(self, record: dict[str, Any]) -> RawCrawlItem:
        year = int(record["year"]) if record.get("year") else None
        return RawCrawlItem(
            title=record["title"],
            type=record.get("type", "Series"),
            year=year,
            country=record.get("country"),
            status=STATUS_MAP.get(str(record.get("status", "")).lower(), "Announced"),
            poster_url=record.get("poster_url"),
            source_url=record.get("source_url", self.base_url),
            source_name=self.name,
        )
