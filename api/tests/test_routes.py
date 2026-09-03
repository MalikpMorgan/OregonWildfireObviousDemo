"""Route contract tests: envelope shape, validation, 404s, and the InciWeb name join."""

import json
from pathlib import Path
from typing import Any

import httpx
import pytest

from app.feeds import inciweb, openmeteo, wfigs
from app.main import app

FIXTURES = Path(__file__).parent / "fixtures"


def load(name: str) -> dict[str, Any]:
    return json.loads((FIXTURES / name).read_text())


def install_client(monkeypatch: pytest.MonkeyPatch, client: httpx.AsyncClient) -> None:
    for module in (wfigs, inciweb):
        monkeypatch.setattr(module, "get_http_client", lambda: client)


def routing_client(
    json_payloads: dict[str, dict[str, Any]], text_payloads: dict[str, str] | None = None
) -> httpx.AsyncClient:
    """Dispatch canned responses by URL substring."""

    def handler(request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        for needle, payload in json_payloads.items():
            if needle in url:
                return httpx.Response(200, json=payload)
        for needle, text in (text_payloads or {}).items():
            if needle in url:
                return httpx.Response(200, text=text)
        return httpx.Response(404, json={"error": f"no fixture for {url}"})

    return httpx.AsyncClient(transport=httpx.MockTransport(handler))

async def synthetic_items() -> list[inciweb.InciwebItem]:
    """RSS stand-in carrying the WFIGS fixture's 'North Cayuse' incident."""
    return [
        inciweb.InciwebItem(
            code="ORMNF",
            name="North Cayuse",
            title="ORMNF North Cayuse",
            link="http://inciweb.wildfire.gov/incident-information/ormnf-north-cayuse",
            summary="Mop-up operations continue on the North Cayuse Fire.",
            lastUpdated="2026-09-03",
            publishedAt="Thu, 03 Sep 2026 09:00:00 EDT",
            guid="999999",
        )
    ]



async def test_envelope_shape_over_http(monkeypatch: pytest.MonkeyPatch) -> None:
    install_client(
        monkeypatch,
        routing_client({"Incident_Locations_Current": load("wfigs_incidents.json")}),
    )
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/fires")
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"status", "data", "meta", "error"}
    assert body["status"] == "ok"
    assert body["error"] is None
    assert body["meta"]["source"] == "wfigs"
    assert body["meta"]["sourceUrl"].startswith("https://")
    assert isinstance(body["meta"]["fetchedAt"], int)
    first = body["data"][0]
    assert {"incidentId", "name", "lat", "lon", "county", "acres", "containmentPct"} <= set(first)


async def test_aqi_requires_lat_and_lon_together() -> None:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        half = await ac.get("/api/aqi", params={"lat": 44.0})
    assert half.status_code == 422  # FastAPI validation, not the envelope


async def test_aqi_point_query_merges_point_and_cities(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    openmeteo_payload = load("openmeteo_current.json")
    transport = httpx.ASGITransport(app=app)

    async def canned_cities() -> list[Any]:
        return [openmeteo.normalize_reading(n, p) for n, p in openmeteo_payload.items()]

    async def canned_point(lat: float, lon: float) -> list[Any]:
        return [openmeteo.normalize_reading("Your location", {"current": {"us_aqi": 77}})]

    monkeypatch.setattr(openmeteo, "fetch_reference_readings", canned_cities)
    monkeypatch.setattr(openmeteo, "fetch_point", canned_point)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/aqi", params={"lat": 44.0, "lon": -121.3})
    body = response.json()
    assert response.status_code == 200
    assert body["status"] == "ok"
    locations = [d["location"] for d in body["data"]]
    assert locations[-1] == "Your location"  # cities first, then the point reading
    assert len(locations) == len(openmeteo_payload) + 1


async def test_narrative_route_joins_by_name_and_serves_summary(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_client(
        monkeypatch,
        routing_client({"Incident_Locations_Current": load("wfigs_incidents.json")}),
    )
    monkeypatch.setattr(inciweb, "fetch_items", synthetic_items)  # WFIGS/RSS names rarely overlap
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/incidents/2026-OR973S-000206/narrative")
    body = response.json()
    assert response.status_code == 200
    assert body["status"] == "ok"
    narrative = body["data"][0]
    assert narrative["incidentId"] == "2026-OR973S-000206"
    assert narrative["inciwebId"] == "ORMNF"
    assert narrative["link"].endswith("ormnf-north-cayuse")
    assert narrative["summary"]


async def test_narrative_route_unknown_incident_404_envelope(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_client(
        monkeypatch,
        routing_client({"Incident_Locations_Current": load("wfigs_incidents.json")}),
    )
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/incidents/nope/narrative")
    assert response.status_code == 404
    body = response.json()
    assert body["status"] == "failed"
    assert "not found" in body["error"]


async def test_narrative_route_without_inciweb_match_returns_empty_ok(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """An incident missing from InciWeb serves an empty ok — the UI links the official page."""
    incidents = load("wfigs_incidents.json")
    incidents = {
        **incidents,
        "features": [
            f
            for f in incidents["features"]
            if f["properties"].get("IncidentName") != "North Cayuse"
        ],
    }
    # Re-add a synthetic incident with a name absent from the RSS fixture.
    incidents["features"].append(
        {
            "properties": {
                "UniqueFireIdentifier": "2026-ORXXX-999999",
                "IncidentName": "Totally Unlisted",
            },
            "geometry": {"type": "Point", "coordinates": [-120.5, 44.5]},
        }
    )
    rss_xml = (FIXTURES / "inciweb_rss.xml").read_text()
    install_client(
        monkeypatch,
        routing_client(
            {"Incident_Locations_Current": incidents},
            text_payloads={"/incidents/rss.xml": rss_xml},
        ),
    )
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/incidents/2026-ORXXX-999999/narrative")
    body = response.json()
    assert response.status_code == 200
    assert body["status"] == "ok"
    assert body["data"] == []


async def test_fires_join_sets_inciweb_id_when_present(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_client(
        monkeypatch,
        routing_client({"Incident_Locations_Current": load("wfigs_incidents.json")}),
    )
    monkeypatch.setattr(inciweb, "fetch_items", synthetic_items)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/fires")
    body = response.json()
    joined = [d["inciwebId"] for d in body["data"] if d["inciwebId"]]
    assert "ORMNF" in joined  # North Cayuse joins the synthetic RSS item by name
