"""Title text normalization.

Goal: make "The Loyal Pin", "THE LOYAL PIN" and "The-Loyal-Pin" compare
equal, while never merging different seasons of the same show (see
product spec section 24).
"""
import re
import unicodedata

_SEASON_PATTERN = re.compile(r"\b(season|s)\s?(\d+)\b", re.IGNORECASE)
_WHITESPACE_PATTERN = re.compile(r"\s+")
_PUNCTUATION_PATTERN = re.compile(r"[^\w\s]")

# Aliases the crawler has confirmed refer to the same title text choice,
# not the same season. Extend this table as sources reveal aliases;
# never guess an alias automatically.
KNOWN_ALIASES: dict[str, str] = {}


def normalize_title(raw_title: str) -> str:
    """Returns a comparable, lowercase, punctuation-free title string.

    Season markers ("Season 2", "S2") are preserved as a trailing
    " season N" token rather than stripped, so normalize_title alone
    is NOT sufficient to detect duplicates across seasons: the caller
    still has to compare season tokens explicitly before merging.
    """
    text = unicodedata.normalize("NFKC", raw_title)
    text = text.replace("&", " and ")
    text = text.replace("-", " ").replace(":", " ")
    text = text.strip()

    season_match = _SEASON_PATTERN.search(text)
    season_token = f" season {season_match.group(2)}" if season_match else ""
    text = _SEASON_PATTERN.sub("", text)

    text = _PUNCTUATION_PATTERN.sub("", text)
    text = _WHITESPACE_PATTERN.sub(" ", text).strip().lower()

    if text in KNOWN_ALIASES:
        text = KNOWN_ALIASES[text]

    return f"{text}{season_token}".strip()


def slugify(title: str, year: int | None = None) -> str:
    """URL slug for a title. Caller appends -2, -3, ... on collision
    (see product spec section 68)."""
    base = normalize_title(title).replace(" ", "-")
    return f"{base}-{year}" if year else base
