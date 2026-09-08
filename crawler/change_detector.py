"""Detects metadata changes between an existing titles row and a fresh
crawl item, so title_changes gets a full history instead of a silent
overwrite (product spec sections 27-28)."""
from dataclasses import dataclass
from typing import Any

TRACKED_FIELDS = [
    "canonical_title",
    "poster_url",
    "release_date",
    "release_status",
    "country",
    "language",
    "episode_count",
    "runtime_minutes",
    "description",
    "official_url",
]


@dataclass
class FieldChange:
    field: str
    old_value: Any
    new_value: Any


def detect_changes(existing_row: dict, new_values: dict) -> list[FieldChange]:
    changes: list[FieldChange] = []

    for field in TRACKED_FIELDS:
        old_value = existing_row.get(field)
        new_value = new_values.get(field)

        if new_value is None:
            continue  # never overwrite a known value with an unknown one

        if old_value != new_value:
            changes.append(FieldChange(field=field, old_value=old_value, new_value=new_value))

    return changes
