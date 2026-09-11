"""Tests for AniListAdapter.fetch()'s use of pageInfo.hasNextPage
(crawler/sources/anilist.py), which was previously requested in the
GraphQL query but never actually used to fetch a second page.
"""
import json

import httpx

from crawler.sources.anilist import AniListAdapter


def make_page(has_next: bool, media_id: int) -> dict:
    return {"data": {"Page": {"pageInfo": {"hasNextPage": has_next}, "media": [{"id": media_id}]}}}


def test_fetch_stops_after_one_page_when_there_is_no_next_page():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=make_page(has_next=False, media_id=1))

    adapter = AniListAdapter()
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        payloads = adapter.fetch(client)

    assert len(payloads) == 1


def test_fetch_follows_has_next_page_up_to_the_configured_limit():
    calls = {"count": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["count"] += 1
        body = json.loads(request.content)
        page = body["variables"]["page"]
        # Three real pages of data, then AniList reports no more.
        has_next = page < 3
        return httpx.Response(200, json=make_page(has_next=has_next, media_id=page))

    adapter = AniListAdapter()
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        payloads = adapter.fetch(client)

    assert len(payloads) == 3
    assert calls["count"] == 3
