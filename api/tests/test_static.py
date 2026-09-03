"""Contract tests for the optional SPA static-hosting surface (single-origin preview)."""

import httpx
import pytest

from app.main import create_app


async def test_root_404s_without_spa_dist(client: httpx.AsyncClient) -> None:
    """The default build serves API-only — / has no handler when SPA_DIST_DIR is unset."""
    response = await client.get("/")

    assert response.status_code == 404


async def test_serves_index_at_root(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    (tmp_path / "index.html").write_text("<!doctype html><title>dashboard</title>")
    monkeypatch.setenv("SPA_DIST_DIR", str(tmp_path))
    transport = httpx.ASGITransport(app=create_app())
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as spa_client:
        response = await spa_client.get("/")

    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "dashboard" in response.text


async def test_api_routes_take_precedence_over_static(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    (tmp_path / "index.html").write_text("<html></html>")
    monkeypatch.setenv("SPA_DIST_DIR", str(tmp_path))
    transport = httpx.ASGITransport(app=create_app())
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as spa_client:
        response = await spa_client.get("/healthz")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_serves_static_assets(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    (tmp_path / "index.html").write_text("<html><body>dashboard</body></html>")
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "app.js").write_text("console.log('app')")
    monkeypatch.setenv("SPA_DIST_DIR", str(tmp_path))
    transport = httpx.ASGITransport(app=create_app())
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as spa_client:
        response = await spa_client.get("/assets/app.js")

    assert response.status_code == 200
    assert "console.log" in response.text


def test_invalid_dist_dir_fails_startup(monkeypatch: pytest.MonkeyPatch) -> None:
    """A typo'd SPA_DIST_DIR fails loudly at startup instead of serving API-only."""
    monkeypatch.setenv("SPA_DIST_DIR", "/nonexistent/dist")

    with pytest.raises(RuntimeError, match="index.html"):
        create_app()
