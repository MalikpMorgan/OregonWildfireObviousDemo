"""NWS normalizer unit tests against recorded live fixtures (spec criterion 9)."""

import json
from pathlib import Path
from typing import Any

import httpx

from app.feeds import nws

FIXTURES = Path(__file__).parent / "fixtures"


def load(name: str) -> dict[str, Any]:
    return json.loads((FIXTURES / name).read_text())


def mock_client(payload: dict[str, Any]) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _request: httpx.Response(200, json=payload))
    )


def test_fixture_contains_both_relevances_and_null_geometry() -> None:
    """The recorded feed mixes fire-weather events, noise, and null-geometry alerts."""
    features = load("nws_alerts.json")["features"]
    events = {f["properties"]["event"] for f in features}
    assert "Red Flag Warning" in events
    assert "Flash Flood Watch" in events  # must be filtered out by the client
    assert any(f.get("geometry") is None for f in features)  # NWS null-geometry case
    assert any(f.get("geometry") is not None for f in features)  # polygon passthrough case


def test_fire_relevant_filter() -> None:
    assert nws.is_fire_relevant("Red Flag Warning")
    assert nws.is_fire_relevant("Fire Weather Watch")
    assert not nws.is_fire_relevant("Flash Flood Watch")
    assert not nws.is_fire_relevant("Tornado Warning")


def test_normalize_alert_null_geometry() -> None:
    feature = next(
        f
        for f in load("nws_alerts.json")["features"]
        if f.get("geometry") is None and f["properties"]["event"] == "Red Flag Warning"
    )
    alert = nws.normalize_alert(feature)
    assert alert is not None
    assert alert.geometry is None
    assert alert.nwsId.startswith("urn:oid:")  # NWS ids are URNs, not URLs
    assert alert.areaDesc
    assert alert.expires
    assert alert.source == "nws"


def test_normalize_alert_polygon_passthrough() -> None:
    feature = next(f for f in load("nws_alerts.json")["features"] if f.get("geometry"))
    alert = nws.normalize_alert(feature)
    assert alert is not None
    assert alert.geometry is not None
    assert alert.geometry.type == "Polygon"
    assert alert.geometry.coordinates


async def test_fetch_filters_to_fire_relevant() -> None:
    alerts = await nws.fetch_oregon_alerts(mock_client(load("nws_alerts.json")))
    assert alerts, "fixture contains Red Flag Warnings — they must survive the filter"
    assert all(nws.is_fire_relevant(a.event) for a in alerts)
    assert all(a.event != "Flash Flood Watch" for a in alerts)
