"""Fuzzy duplicate detection using rapidfuzz.

Confidence bands (see product spec section 25 and config.py):
  >= 0.95              probably the same title, safe to auto-match
  0.80 - 0.95          needs admin review before merging
  <  0.80              treated as a different title
"""
from dataclasses import dataclass

from rapidfuzz import fuzz

from .config import DUPLICATE_CONFIDENCE_THRESHOLD, REVIEW_CONFIDENCE_THRESHOLD
from .normalizer import normalize_title


@dataclass
class CandidateTitle:
    id: str
    normalized_title: str
    year: int | None
    country: str | None


def score_match(new_normalized_title: str, new_year: int | None, candidate: CandidateTitle) -> float:
    """Title similarity, penalized when the release year clearly differs.

    A strong text match with a mismatched year is very likely a
    different season or a remake, not a duplicate, so the penalty is
    intentionally harsh rather than averaged in softly.
    """
    text_score = fuzz.token_sort_ratio(new_normalized_title, candidate.normalized_title) / 100

    if new_year and candidate.year and abs(new_year - candidate.year) >= 1:
        text_score *= 0.5

    return round(text_score, 3)


def find_best_match(
    raw_title: str, year: int | None, candidates: list[CandidateTitle]
) -> tuple[CandidateTitle | None, float]:
    normalized = normalize_title(raw_title)

    best_candidate: CandidateTitle | None = None
    best_score = 0.0

    for candidate in candidates:
        score = score_match(normalized, year, candidate)
        if score > best_score:
            best_score = score
            best_candidate = candidate

    return best_candidate, best_score


def classify_match(score: float) -> str:
    if score >= DUPLICATE_CONFIDENCE_THRESHOLD:
        return "duplicate"
    if score >= REVIEW_CONFIDENCE_THRESHOLD:
        return "uncertain"
    return "new"
