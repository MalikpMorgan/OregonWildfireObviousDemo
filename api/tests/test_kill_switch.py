"""Kill-switch matrix: every upstream failing, in every order, without a 500.

TTL is patched to 0 seconds so each request attempts a live fetch; the shared cache
(conftest-cleared per test) holds last-good data for the stale leg. The shared client
factory is patched in each feed module's namespace — the fetchers bind it at import.
"""

import json
from pathlib import Path
from typing import Any

import httpx
import pytest

from app import routes
from app.cache import CACHE
from app.feeds import inciweb, nws, openmeteo, wfigs
from app.main import app

FIXTURES = Path(__file__).parent / "fixtures"


def load(name: str) -> dict[str, Any]:
    return json.loads((FIXTURES / name).read_text())


@pytest.fixture(autouse=True)
def _zero_ttls(monkeypatch: pytest.MonkeyPatch) -> None:
    """Force a fetch attempt on every request — the kill-switch then decides."""
    monkeypatch.setattr(
        "app.config.FEED_TTL_DEFAULTS",
        {k: 0 for k in ("nws", "wfigs_points", "wfigs_perimeters", "inciweb", "aqi")},
    )


def install_client(monkeypatch: pytest.MonkeyPatch, client: httpx.AsyncClient) -> None:
    """Route every feed module's shared-client lookup at the canned client."""
    for module in (wfigs, nws, openmeteo, inciweb):
        monkeypatch.setattr(module, "get_http_client", lambda: client)


def failing_client(status: int = 503) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _request: httpx.Response(status))
    )


def canned_client(payload: dict[str, Any]) -> httpx.AsyncClient:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=payload)

    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


async def test_ok_then_stale_then_failed_when_upstream_dies(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The spec's three-state ladder on one feed: ok → stale → failed."""
    install_client(monkeypatch, canned_client(load("wfigs_incidents.json")))

    async def no_join(_: Any) -> None:
        return None

    ok = await routes.fires()
    assert ok.status == "ok" and ok.data

    install_client(monkeypatch, failing_client())
    monkeypatch.setattr(routes, "_attach_inciweb_ids", no_join)
    stale = await routes.fires()
    assert stale.status == "stale"
    assert stale.data == ok.data
    assert stale.error is None

    CACHE.clear()  # no last-good copy left
    dead = await routes.fires()
    assert dead.status == "failed"
    assert dead.data is None
    assert dead.error is not None


@pytest.mark.parametrize("route", [routes.perimeters, routes.alerts], ids=["perimeters", "alerts"])
async def test_failing_upstream_never_500s(
    route: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Each simple feed: failure with no last-good data yields failed, not an exception."""
    install_client(monkeypatch, failing_client())
    result = await route()
    assert result.status == "failed"
    assert result.data is None
    assert result.error is not None


async def test_aqi_partial_failure_degrades(monkeypatch: pytest.MonkeyPatch) -> None:
    """Cities fail, point succeeds → failed envelope still carries the point data."""

    async def dead_cities() -> list[Any]:
        raise httpx.ConnectError("open-meteo down")

    async def alive_point(lat: float, lon: float) -> list[Any]:
        return [openmeteo.normalize_reading("Your location", {"current": {"us_aqi": 66}})]

    monkeypatch.setattr(openmeteo, "fetch_reference_readings", dead_cities)
    monkeypatch.setattr(openmeteo, "fetch_point", alive_point)
    result = await routes.aqi(lat=44.0, lon=-121.0)
    assert result.status == "failed"  # worst part wins
    assert result.error is not None
    assert len(result.data or []) == 1


async def test_aqi_totally_failed_still_envelope(monkeypatch: pytest.MonkeyPatch) -> None:
    async def dead() -> list[Any]:
        raise httpx.ConnectError("open-meteo down")

    monkeypatch.setattr(openmeteo, "fetch_reference_readings", dead)
    # explicit defaults — FastAPI Query objects only materialize over HTTP
    result = await routes.aqi(lat=None, lon=None)
    assert result.status == "failed"
    assert result.data is None
    assert result.error is not None


async def test_narrative_route_survives_full_outage(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """WFIGS down with no last-good copy → narrative route serves failed, not a 500."""
    install_client(monkeypatch, failing_client())
    result = await routes.incident_narrative("whatever-id")
    assert result.status == "failed"
    assert result.data is None
    assert result.error is not None


async def test_routes_via_http_transport_serve_200_envelope(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """End-to-end over ASGI: a dead upstream still returns HTTP 200 with failed envelope."""
    install_client(monkeypatch, failing_client())
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        for path in ("/api/fires", "/api/perimeters", "/api/alerts", "/api/aqi"):
            response = await ac.get(path)
            assert response.status_code == 200, path
            body = response.json()
            assert body["status"] == "failed"
            assert body["data"] is None
            assert body["meta"]["source"]


async def test_wfigs_perimeter_query_uses_prefixed_filter(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The perimeter query filters on attr_POOState — the plain where= returns 0 rows."""
    seen: dict[str, str] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        return httpx.Response(200, json=load("wfigs_perimeters.json"))

    install_client(
        monkeypatch,
        httpx.AsyncClient(transport=httpx.MockTransport(handler)),
    )
    result = await routes.perimeters()
    assert result.status == "ok"
    # httpx percent-encodes = as %3D and quotes as %27 inside the where value
    assert "where=attr_POOState%3D%27US-OR%27" in seen["url"]
    assert "outSR=4326" in seen["url"]
