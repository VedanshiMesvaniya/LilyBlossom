"""Poster download + dedupe by content hash before upload to Supabase
Storage (bucket: title-posters). Prefers official/licensed sources
first, per product spec section 29."""
import hashlib

import httpx

from .config import REQUEST_TIMEOUT_SECONDS, USER_AGENT


class PosterFetchError(Exception):
    pass


def fetch_poster_bytes(url: str) -> bytes:
    headers = {"User-Agent": USER_AGENT}
    try:
        response = httpx.get(url, headers=headers, timeout=REQUEST_TIMEOUT_SECONDS, follow_redirects=True)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise PosterFetchError(f"Could not fetch poster from {url}: {exc}") from exc

    return response.content


def hash_poster(image_bytes: bytes) -> str:
    return hashlib.sha256(image_bytes).hexdigest()


def build_storage_path(title_slug: str, image_hash: str, extension: str = "jpg") -> str:
    return f"{title_slug}/{image_hash[:16]}.{extension}"
