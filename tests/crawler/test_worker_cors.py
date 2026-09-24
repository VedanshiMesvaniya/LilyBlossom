"""An empty FRONTEND_ORIGIN (the blank line in .env.example) must fall
back to '*' for local development, not block every browser request."""
import importlib

from fastapi.testclient import TestClient


def preflight(client):
    return client.options(
        "/sources",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "PATCH",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )


def load_worker(monkeypatch, value):
    monkeypatch.setenv("FRONTEND_ORIGIN", value)
    monkeypatch.setenv("ENVIRONMENT", "development")
    import crawler.worker as worker

    return importlib.reload(worker)


def test_blank_frontend_origin_still_allows_local_browser_requests(monkeypatch):
    worker = load_worker(monkeypatch, "")
    assert worker.FRONTEND_ORIGIN == "*"
    assert preflight(TestClient(worker.app)).status_code == 200


def test_explicit_frontend_origin_is_used(monkeypatch):
    worker = load_worker(monkeypatch, "http://localhost:5173")
    response = preflight(TestClient(worker.app))
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
