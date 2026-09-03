"""Contract tests for the health and CORS surface."""

import httpx
import pytest

from app.main import create_app


async def test_healthz_returns_ok(client: httpx.AsyncClient) -> None:
    response = await client.get("/healthz")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_cors_allows_default_dev_origin(client: httpx.AsyncClient) -> None:
    response = await client.get("/healthz", headers={"Origin": "http://localhost:5173"})

    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


async def test_cors_rejects_unlisted_origin(client: httpx.AsyncClient) -> None:
    response = await client.get("/healthz", headers={"Origin": "https://unlisted.example"})

    assert "access-control-allow-origin" not in response.headers


async def test_cors_allows_origin_configured_via_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "https://dashboard.example.org")
    transport = httpx.ASGITransport(app=create_app())
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as custom_client:
        response = await custom_client.get(
            "/healthz", headers={"Origin": "https://dashboard.example.org"}
        )

    assert response.headers["access-control-allow-origin"] == "https://dashboard.example.org"
