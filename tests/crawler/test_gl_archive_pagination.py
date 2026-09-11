"""Tests for GLArchiveAdapter.fetch()'s pagination handling
(crawler/sources/gl_archive.py). Uses httpx.MockTransport so these run
without any real network access to glarchive.net, which this
environment cannot reach anyway.
"""
import httpx

from crawler.sources.gl_archive import GLArchiveAdapter


def page_response(request: httpx.Request, pages: dict[str, str]) -> httpx.Response:
    html = pages.get(str(request.url))
    if html is None:
        return httpx.Response(404, text="not found")
    return httpx.Response(200, text=html)


def test_fetch_stops_at_one_page_when_there_is_no_next_link():
    pages = {"https://glarchive.net/catalog/": "<html><body>no pagination here</body></html>"}
    transport = httpx.MockTransport(lambda request: page_response(request, pages))

    adapter = GLArchiveAdapter()
    with httpx.Client(transport=transport) as client:
        payloads = adapter.fetch(client)

    assert payloads == [pages["https://glarchive.net/catalog/"]]


def test_fetch_follows_rel_next_across_multiple_pages():
    pages = {
        "https://glarchive.net/catalog/": '<html><head><link rel="next" href="?page=2"></head><body>page 1</body></html>',
        "https://glarchive.net/catalog/?page=2": '<html><head><link rel="next" href="?page=3"></head><body>page 2</body></html>',
        "https://glarchive.net/catalog/?page=3": "<html><body>page 3, no more pages</body></html>",
    }
    transport = httpx.MockTransport(lambda request: page_response(request, pages))

    adapter = GLArchiveAdapter()
    with httpx.Client(transport=transport) as client:
        payloads = adapter.fetch(client)

    assert len(payloads) == 3
    assert "page 1" in payloads[0]
    assert "page 3" in payloads[2]


def test_fetch_follows_a_text_labelled_next_link():
    pages = {
        "https://glarchive.net/catalog/": '<html><body><a href="/catalog/page/2/">Next</a></body></html>',
        "https://glarchive.net/catalog/page/2/": "<html><body>last page</body></html>",
    }
    transport = httpx.MockTransport(lambda request: page_response(request, pages))

    adapter = GLArchiveAdapter()
    with httpx.Client(transport=transport) as client:
        payloads = adapter.fetch(client)

    assert len(payloads) == 2


def test_fetch_does_not_loop_forever_on_a_self_referencing_next_link():
    pages = {
        "https://glarchive.net/catalog/": '<html><head><link rel="next" href="."></head><body>loops back</body></html>',
    }
    transport = httpx.MockTransport(lambda request: page_response(request, pages))

    adapter = GLArchiveAdapter()
    with httpx.Client(transport=transport) as client:
        payloads = adapter.fetch(client)

    assert len(payloads) == 1
