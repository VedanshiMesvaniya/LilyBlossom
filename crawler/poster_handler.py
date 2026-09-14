"""Poster download + dedupe by content hash before upload to Supabase
Storage (bucket: title-posters). Prefers official/licensed sources
first, per product spec section 29.

Until now this module only downloaded bytes and worked out a hash and
a storage path; nothing actually called Supabase Storage, so every
title kept hotlinking whatever poster URL its source gave. This adds
the missing upload step: store_poster_for_title() is the one function
the rest of the crawler should call.
"""
import hashlib
import mimetypes

import httpx

from .config import REQUEST_TIMEOUT_SECONDS, USER_AGENT

POSTER_BUCKET = "title-posters"
DEFAULT_EXTENSION = "jpg"


class PosterFetchError(Exception):
    pass


def fetch_poster(url: str) -> tuple[bytes, str | None]:
    """Downloads the image at url. Returns its bytes and the
    response's Content-Type header, so callers can pick a sensible
    file extension without a second request."""
    headers = {"User-Agent": USER_AGENT}
    try:
        response = httpx.get(url, headers=headers, timeout=REQUEST_TIMEOUT_SECONDS, follow_redirects=True)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise PosterFetchError(f"Could not fetch poster from {url}: {exc}") from exc

    return response.content, response.headers.get("content-type")


def fetch_poster_bytes(url: str) -> bytes:
    """Thin wrapper over fetch_poster() for callers that only need
    the raw bytes."""
    image_bytes, _content_type = fetch_poster(url)
    return image_bytes


def hash_poster(image_bytes: bytes) -> str:
    return hashlib.sha256(image_bytes).hexdigest()


def guess_extension(url: str, content_type: str | None) -> str:
    """Picks a file extension for the storage path. Prefers the
    response's real Content-Type over guessing from the URL, since a
    source can serve a poster at a URL with no extension at all or a
    misleading one. Falls back to the URL's own extension, then to
    DEFAULT_EXTENSION."""
    if content_type:
        guessed = mimetypes.guess_extension(content_type.split(";")[0].strip())
        if guessed:
            return guessed.lstrip(".")

    last_segment = url.split("?")[0].rsplit("/", 1)[-1]
    if "." in last_segment:
        url_ext = last_segment.rsplit(".", 1)[-1].lower()
        if url_ext in {"jpg", "jpeg", "png", "webp", "gif"}:
            return url_ext

    return DEFAULT_EXTENSION


def build_storage_path(title_slug: str, image_hash: str, extension: str = DEFAULT_EXTENSION) -> str:
    return f"{title_slug}/{image_hash[:16]}.{extension}"


def store_poster_for_title(
    supabase,
    title_id: str,
    title_slug: str,
    source_url: str,
    source_name: str | None,
) -> str | None:
    """Downloads source_url, uploads it to the title-posters bucket,
    and records it in poster_assets, so the catalog serves posters
    from Supabase Storage instead of hotlinking every source
    directly (product spec section 29).

    If the same image (by content hash) is already stored for this
    title, this skips re-uploading and reuses the existing file.

    Returns the new public storage URL, or None if the download or
    the upload failed for any reason (unreachable image, missing or
    misconfigured bucket, a transient Supabase error). Callers should
    fall back to the original source_url on None rather than losing
    the poster or failing the whole crawl over one image.
    """
    try:
        image_bytes, content_type = fetch_poster(source_url)
    except PosterFetchError:
        return None

    image_hash = hash_poster(image_bytes)

    existing = (
        supabase.table("poster_assets")
        .select("storage_path")
        .eq("title_id", title_id)
        .eq("hash", image_hash)
        .limit(1)
        .execute()
        .data
    )
    if existing:
        return supabase.storage.from_(POSTER_BUCKET).get_public_url(existing[0]["storage_path"])

    extension = guess_extension(source_url, content_type)
    storage_path = build_storage_path(title_slug, image_hash, extension)

    try:
        supabase.storage.from_(POSTER_BUCKET).upload(
            storage_path,
            image_bytes,
            {"content-type": content_type or "image/jpeg", "upsert": "true"},
        )
    except Exception:
        # Bucket missing, a permissions issue, or a transient storage
        # error. None of these should fail the whole crawl over one
        # poster; the caller falls back to the original source_url.
        return None

    supabase.table("poster_assets").insert(
        {
            "title_id": title_id,
            "storage_path": storage_path,
            "source_url": source_url,
            "source_name": source_name,
            "hash": image_hash,
        }
    ).execute()

    return supabase.storage.from_(POSTER_BUCKET).get_public_url(storage_path)
