"""Open-Meteo normalizer unit tests against recorded live fixtures (spec criterion 9)."""

import json
from pathlib import Path
from typing import Any

import httpx

from app.feeds import openmeteo

FIXTURES = Path(__file__).parent / "fixtures"


def load(name: str) -> dict[str, Any]:
    return json.loads((FIXTURES / name).read_text())


def mock_client(payload: dict[str, Any] | None, status: int = 200) -> httpx.AsyncClient:
    def handler(_request: httpx.Request) -> httpx.Response:
        if payload is not None:
            return httpx.Response(status, json=payload)
        return httpx.Response(status)

    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def test_fixture_has_reference_cities_and_rural_towns() -> None:
    payload = load("openmeteo_current.json")
    assert len(payload) >= 5, "spec verification requires >=5 reference cities"
    assert {"Portland", "Salem", "Eugene", "Bend", "Medford"} <= payload.keys()
    assert {"Pendleton", "Klamath Falls", "La Grande"} & payload.keys(), "rural towns included"


def test_aqi_category_bands() -> None:
    assert openmeteo.aqi_category(None) == "Not reported"
    assert openmeteo.aqi_category(0) == "Good"
    assert openmeteo.aqi_category(50) == "Good"
    assert openmeteo.aqi_category(51) == "Moderate"
    assert openmeteo.aqi_category(150) == "Unhealthy for Sensitive Groups"
    assert openmeteo.aqi_category(151) == "Unhealthy"
    assert openmeteo.aqi_category(300) == "Very Unhealthy"
    assert openmeteo.aqi_category(301) == "Hazardous"


def test_normalize_reading_passthrough_and_null() -> None:
    payload = load("openmeteo_current.json")
    reading = openmeteo.normalize_reading("Portland", payload["Portland"])
    assert reading.location == "Portland"
    assert reading.usAqi == payload["Portland"]["current"]["us_aqi"]
    assert reading.categoryLabel == openmeteo.aqi_category(reading.usAqi)
    assert reading.source == "open-meteo"
    assert isinstance(reading.fetchedAt, int)
    assert reading.sourceUrl.startswith("https://")

    nulled = {"current": {"us_aqi": None}}
    null_reading = openmeteo.normalize_reading("Nowhere", nulled)
    assert null_reading.usAqi is None
    assert null_reading.categoryLabel == "Not reported"


async def test_fetch_reading_builds_expected_query() -> None:
    seen: dict[str, Any] = {}

    def capture(request: httpx.Request) -> httpx.Response:
        seen.update(dict(request.url.params))
        return httpx.Response(200, json={"current": {"us_aqi": 42}})

    reading = await openmeteo.fetch_reading(
        "Test", 44.0, -120.5, httpx.AsyncClient(transport=httpx.MockTransport(capture))
    )
    assert seen["latitude"] == "44.0"
    assert seen["longitude"] == "-120.5"
    assert seen["current"] == "us_aqi"
    assert seen["timezone"] == "America/Los_Angeles"
    assert reading.usAqi == 42


async def test_fetch_reading_raises_on_upstream_error() -> None:
    """A failed point raises — /api/aqi degrades the envelope instead of 500ing."""
    client = mock_client(None, status=503)
    try:
        await openmeteo.fetch_reading("Test", 44.0, -120.5, client)
        raise AssertionError("expected HTTPStatusError")
    except httpx.HTTPStatusError:
        pass
    finally:
        await client.aclose()


async def test_fetch_reference_readings_uses_live_schema() -> None:
    payload = load("openmeteo_current.json")
    readings = await openmeteo.fetch_reference_readings(mock_client(payload))
    # The fetcher drives names/coords from REFERENCE_CITIES, not the payload keys
    assert [r.location for r in readings] == list(openmeteo.REFERENCE_CITIES)
    assert all(r.usAqi is None or 0 <= r.usAqi <= 1000 for r in readings)
    # Curated null case: a response whose us_aqi is absent serves "Not reported"
    null_case = openmeteo.normalize_reading("Curated Null Case", payload["PortlandNullAqi"])
    assert null_case.usAqi is None
    assert null_case.categoryLabel == "Not reported"
