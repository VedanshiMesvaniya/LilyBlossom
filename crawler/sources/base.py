"""Base contract every source adapter implements.

fetch()      -> raw HTML/JSON for one listing page
parse()      -> list of loosely-structured dicts scraped from that page
normalize()  -> list[RawCrawlItem], fully typed and cleaned
validate()   -> raises ValidationError and drops anything that fails

main.py only ever calls run(), so adding a new source means writing one
new file in this folder and registering it in main.py's SOURCE_REGISTRY,
never touching the orchestration logic.
"""
from abc import ABC, abstractmethod
from typing import Any

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from ..config import MAX_RETRIES, REQUEST_TIMEOUT_SECONDS, USER_AGENT
from ..models import RawCrawlItem
from ..validator import validate_item, ValidationError


class SourceAdapter(ABC):
    name: str
    base_url: str

    @retry(stop=stop_after_attempt(MAX_RETRIES), wait=wait_exponential(multiplier=2))
    def _get(self, url: str, client: httpx.Client) -> httpx.Response:
        response = client.get(url, headers={"User-Agent": USER_AGENT}, timeout=REQUEST_TIMEOUT_SECONDS)
        response.raise_for_status()
        return response

    @abstractmethod
    def fetch(self, client: httpx.Client) -> list[str]:
        """Returns raw HTML/JSON payloads for every listing page to parse."""

    @abstractmethod
    def parse(self, raw_payload: str) -> list[dict[str, Any]]:
        """Extracts loosely-typed records from one raw payload."""

    @abstractmethod
    def normalize(self, record: dict[str, Any]) -> RawCrawlItem:
        """Converts one scraped record into a RawCrawlItem."""

    def run(self, client: httpx.Client) -> tuple[list[RawCrawlItem], list[str]]:
        """Runs fetch -> parse -> normalize -> validate for this source.

        Returns (valid_items, error_messages). A single bad record never
        aborts the whole source, matching product spec section 59: one
        broken source or record should not stop the entire crawl.
        """
        items: list[RawCrawlItem] = []
        errors: list[str] = []

        try:
            payloads = self.fetch(client)
        except httpx.HTTPError as exc:
            return [], [f"{self.name}: fetch failed: {exc}"]

        for payload in payloads:
            try:
                records = self.parse(payload)
            except Exception as exc:  # noqa: BLE001 - log and continue per source
                errors.append(f"{self.name}: parse failed: {exc}")
                continue

            for record in records:
                try:
                    item = self.normalize(record)
                    validate_item(item)
                    items.append(item)
                except (ValidationError, Exception) as exc:  # noqa: BLE001
                    errors.append(f"{self.name}: skipped one record: {exc}")

        return items, errors
