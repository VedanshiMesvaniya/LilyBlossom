"""Sanity checks run on every RawCrawlItem before it reaches the
database. Never fabricate a value here: if a field is unknown, leave
it as None so the UI can show "unknown" instead of made-up data
(product spec section 56)."""
from datetime import date

from .config import CURRENT_YEAR
from .models import RawCrawlItem


class ValidationError(Exception):
    pass


def validate_item(item: RawCrawlItem) -> None:
    if not item.title or not item.title.strip():
        raise ValidationError("Title is empty.")

    if item.year is not None and (item.year < 1990 or item.year > CURRENT_YEAR + 5):
        raise ValidationError(f"Year {item.year} is outside the plausible GL catalog range.")

    if item.episode_count is not None and item.episode_count < 0:
        raise ValidationError("Episode count cannot be negative.")

    if item.runtime_minutes is not None and item.runtime_minutes < 0:
        raise ValidationError("Runtime cannot be negative.")

    if item.type == "Movie" and item.episode_count:
        raise ValidationError("A Movie should not carry an episode_count; check the source parser.")

    if item.release_date is not None and item.release_date > date(CURRENT_YEAR + 5, 12, 31):
        raise ValidationError("Release date is implausibly far in the future.")
