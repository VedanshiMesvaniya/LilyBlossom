"""Crawler entry point.

Usage (run as a module so the relative imports resolve):
    python -m crawler.main --dry-run   # crawl, normalize, dedupe, report - never writes
    python -m crawler.main             # crawl and write to the configured database

The pipeline per source, matching product spec section 20:
    load enabled sources -> fetch -> parse -> normalize -> validate
    -> deduplicate -> compare DB -> new/updated/duplicate/uncertain
    -> store crawl results -> generate summary
"""
import argparse
import sys
import time
from datetime import datetime, timezone

import httpx
from supabase import create_client, Client

from .config import SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL
from .deduplicator import CandidateTitle, classify_match, find_best_match
from .models import CrawlRunSummary, RawCrawlItem
from .normalizer import normalize_title, slugify
from .sources.base import SourceAdapter
from .sources.gl_archive import GLArchiveAdapter
from .sources.gl_central import GLCentralAdapter
from .sources.glthai import GLThaiAdapter
from .sources.shipsbloom import ShipsBloomAdapter

# Registering a new source is the only thing needed here; main() itself
# never needs to change to add another adapter.
SOURCE_REGISTRY: list[type[SourceAdapter]] = [
    GLArchiveAdapter,
    GLCentralAdapter,
    GLThaiAdapter,
    ShipsBloomAdapter,
]


def get_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError(
            "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set "
            "for the crawler to read/write the catalog."
        )
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def load_existing_candidates(supabase: Client) -> list[CandidateTitle]:
    response = supabase.table("titles").select("id, canonical_title, release_year, country").execute()
    return [
        CandidateTitle(
            id=row["id"],
            normalized_title=normalize_title(row["canonical_title"]),
            year=row.get("release_year"),
            country=row.get("country"),
        )
        for row in response.data
    ]


def run_crawl(dry_run: bool) -> CrawlRunSummary:
    summary = CrawlRunSummary()
    all_items: list[RawCrawlItem] = []
    all_errors: list[str] = []

    with httpx.Client() as client:
        for adapter_cls in SOURCE_REGISTRY:
            adapter = adapter_cls()
            items, errors = adapter.run(client)
            summary.sources_checked += 1
            summary.items_found += len(items)
            all_items.extend(items)
            all_errors.extend(errors)
            time.sleep(1.5)  # politeness delay between sources

    supabase = None if dry_run else get_supabase()
    candidates = load_existing_candidates(supabase) if supabase else []

    for item in all_items:
        best_candidate, score = find_best_match(item.title, item.year, candidates)
        state = classify_match(score) if best_candidate else "new"

        if state == "duplicate":
            summary.duplicates += 1
        elif state == "uncertain":
            summary.uncertain_items += 1
        else:
            summary.new_items += 1

        if dry_run:
            continue

        supabase.table("crawl_items").insert(
            {
                "raw_title": item.title,
                "normalized_title": normalize_title(item.title),
                "payload": item.model_dump(mode="json"),
                "matched_title_id": best_candidate.id if best_candidate else None,
                "match_confidence": score,
                "state": state,
            }
        ).execute()

    summary.errors = len(all_errors)

    if dry_run:
        print("DRY RUN - nothing was written to the database.")
    print(f"Sources checked: {summary.sources_checked}")
    print(f"Items found: {summary.items_found}")
    print(f"New: {summary.new_items}  Duplicates: {summary.duplicates}  Uncertain: {summary.uncertain_items}")
    print(f"Errors: {summary.errors}")
    for error in all_errors:
        print(f"  - {error}")

    if not dry_run and supabase:
        supabase.table("crawl_runs").insert(
            {
                "finished_at": datetime.now(timezone.utc).isoformat(),
                "status": "success" if summary.errors == 0 else "partial_success",
                "sources_checked": summary.sources_checked,
                "items_found": summary.items_found,
                "new_items": summary.new_items,
                "updated_items": summary.updated_items,
                "duplicates": summary.duplicates,
                "uncertain_items": summary.uncertain_items,
                "errors": summary.errors,
            }
        ).execute()

    return summary


def main() -> int:
    parser = argparse.ArgumentParser(description="LilyBlossom daily catalog crawler.")
    parser.add_argument("--dry-run", action="store_true", help="Crawl and report only, never write to the database.")
    args = parser.parse_args()

    try:
        run_crawl(dry_run=args.dry_run)
    except Exception as exc:  # noqa: BLE001
        print(f"Crawl failed: {exc}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
