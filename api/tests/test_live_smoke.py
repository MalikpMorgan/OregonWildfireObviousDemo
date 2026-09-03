"""Live smoke tests — skipped unless LIVE_FEEDS=1 (offline CI stays green).

Each check hits the real upstream once and asserts only the envelope contract and the
feed facts the spec pins: US-OR filtering, EPSG:4326 coordinates, fire-weather events,
reference-city coverage, and RSS shape. Assertions are loose on purpose — live feeds
fluctuate (fire seasons end, RSS rosters turn over).
"""

import os

import httpx
import pytest

from app.config import feed_timeout_seconds
from app.feeds import inciweb, nws, openmeteo, wfigs

LIVE = os.environ.get("LIVE_FEEDS", "").strip() == "1"

pytestmark = pytest.mark.skipif(not LIVE, reason="live feeds: set LIVE_FEEDS=1 to enable")


@pytest.fixture
async def live_client() -> httpx.AsyncClient:
    client = httpx.AsyncClient(timeout=feed_timeout_seconds(), follow_redirects=True)
    yield client
    await client.aclose()


async def test_live_wfigs_incidents(live_client: httpx.AsyncClient) -> None:
    incidents = await wfigs.fetch_oregon_incidents(live_client)
    assert incidents, "expected at least one Oregon incident"
    for incident in incidents:
        assert -126.0 < incident.lon < -114.0  # decimal degrees, not NAD83 meters
        assert 40.0 < incident.lat < 48.0
        assert incident.county is None or incident.county


async def test_live_nws_alerts(live_client: httpx.AsyncClient) -> None:
    alerts = await nws.fetch_oregon_alerts(live_client)
    assert all(nws.is_fire_relevant(a.event) for a in alerts)
    assert all(a.expires is None or a.expires for a in alerts)


async def test_live_openmeteo_cities(live_client: httpx.AsyncClient) -> None:
    readings = await openmeteo.fetch_reference_readings(live_client)
    assert len(readings) >= 5
    assert all(r.usAqi is None or 0 <= r.usAqi <= 1000 for r in readings)


async def test_live_inciweb_rss(live_client: httpx.AsyncClient) -> None:
    items = await inciweb.fetch_items(live_client)
    assert items
    assert all(i.title for i in items)
