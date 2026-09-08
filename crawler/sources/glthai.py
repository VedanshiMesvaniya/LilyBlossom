"""GLThai adapter.

Focused on Thai GL series, which are a large share of the current
catalog (product spec section 3, country examples). This is a
JavaScript-rendered site in many cases, so production deployment should
route this adapter's fetch() through Playwright instead of plain httpx
if the listing page requires client-side rendering; verify that against
the live site first, since this sandbox cannot reach it.
"""
from typing import Any

import httpx
from bs4 import BeautifulSoup

from ..config import CURRENT_YEAR
from ..models import RawCrawlItem
from .base import SourceAdapter


class GLThaiAdapter(SourceAdapter):
    name = "GLThai"
    base_url = "https://example-glthai.invalid/series"  # placeholder until the real URL is confirmed

    def fetch(self, client: httpx.Client) -> list[str]:
        response = self._get(self.base_url, client)
        return [response.text]

    def parse(self, raw_payload: str) -> list[dict[str, Any]]:
        soup = BeautifulSoup(raw_payload, "lxml")
        records: list[dict[str, Any]] = []

        for row in soup.select(".series-item"):
            title_el = row.select_one(".series-item__title")
            if not title_el:
                continue
            records.append(
                {
                    "title": title_el.get_text(strip=True),
                    "episode_count": row.get("data-episodes"),
                    "year": row.get("data-year"),
                    "poster_url": row.select_one("img")["src"] if row.select_one("img") else None,
                    "source_url": row.select_one("a")["href"] if row.select_one("a") else self.base_url,
                }
            )

        return records

    def normalize(self, record: dict[str, Any]) -> RawCrawlItem:
        year = int(record["year"]) if record.get("year") else None
        episode_count = int(record["episode_count"]) if record.get("episode_count") else None
        return RawCrawlItem(
            title=record["title"],
            type="Series",
            year=year or CURRENT_YEAR,
            country="Thailand",
            episode_count=episode_count,
            poster_url=record.get("poster_url"),
            source_url=record.get("source_url", self.base_url),
            source_name=self.name,
        )
