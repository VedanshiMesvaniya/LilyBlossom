"""GL Archive adapter (glarchive.net/catalog).

GL Archive specifically catalogues Girls' Love (GL) and Yuri media across
series and movies, including release states such as on-air, in-production,
completed, upcoming, and announced (product spec section 18).
"""
from typing import Any
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup

from ..config import MAX_GL_ARCHIVE_PAGES
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

# Text on a "go to the next page" link/button, checked case
# insensitively. This environment cannot reach glarchive.net to see
# its real pagination markup, so rather than guess a specific
# selector (and risk silently skipping pages if the guess is wrong),
# _find_next_page_url() below looks for the two ways sites commonly
# expose this that do not require guessing: a standard
# <link rel="next"> tag, or an anchor whose visible text says one of
# these. If neither is present, fetch() correctly stops at one page,
# exactly like before, rather than fetching something wrong.
NEXT_PAGE_LINK_TEXT = {"next", "next page", "load more", "»", "more"}


class GLArchiveAdapter(SourceAdapter):
    name = "GL Archive"
    base_url = "https://glarchive.net/catalog/"

    def _find_next_page_url(self, html: str, current_url: str) -> str | None:
        soup = BeautifulSoup(html, "lxml")

        link_next = soup.select_one("link[rel='next']")
        if link_next and link_next.get("href"):
            return urljoin(current_url, link_next["href"])

        for anchor in soup.select("a[href]"):
            text = anchor.get_text(strip=True).lower()
            if text in NEXT_PAGE_LINK_TEXT:
                next_url = urljoin(current_url, anchor["href"])
                if next_url != current_url:
                    return next_url

        return None

    def fetch(self, client: httpx.Client) -> list[str]:
        pages: list[str] = []
        seen_urls: set[str] = set()
        url = self.base_url

        for _ in range(MAX_GL_ARCHIVE_PAGES):
            response = self._get(url, client)
            pages.append(response.text)
            seen_urls.add(url)

            next_url = self._find_next_page_url(response.text, url)
            if not next_url or next_url in seen_urls:
                break
            url = next_url

        return pages

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
