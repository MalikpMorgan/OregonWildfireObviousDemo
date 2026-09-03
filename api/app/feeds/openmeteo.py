"""Open-Meteo Air Quality client — keyless US AQI (research artifact §1.5).

Values are model estimates, not monitor observations — the UI labels them "model
estimate" alongside links to Oregon DEQ / OregonSmoke monitor data.
"""

import asyncio
from typing import Any

import httpx

from app.cache import now_ms
from app.feeds import get_http_client
from app.models import AirReading

AQ_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
SOURCE_URL = "https://open-meteo.com/en/docs/air-quality-api"

# >=5 reference cities incl. rural Oregon (spec verification criterion 4).
REFERENCE_CITIES: dict[str, tuple[float, float]] = {
    "Portland": (45.52, -122.68),
    "Salem": (44.94, -123.04),
    "Eugene": (44.05, -123.09),
    "Bend": (44.06, -121.31),
    "Medford": (42.33, -122.87),
    "Pendleton": (45.67, -118.79),  # rural
    "Klamath Falls": (42.22, -121.78),  # rural
    "La Grande": (45.32, -118.08),  # rural
}


def aqi_category(us_aqi: float | None) -> str:
    """US EPA AQI band as a text label — meaning never carried by color alone."""
    if us_aqi is None:
        return "Not reported"
    if us_aqi <= 50:
        return "Good"
    if us_aqi <= 100:
        return "Moderate"
    if us_aqi <= 150:
        return "Unhealthy for Sensitive Groups"
    if us_aqi <= 200:
        return "Unhealthy"
    if us_aqi <= 300:
        return "Very Unhealthy"
    return "Hazardous"


def normalize_reading(location: str, payload: dict[str, Any]) -> AirReading:
    """Map one Open-Meteo air-quality response; us_aqi can be null (model gaps)."""
    current = payload.get("current") or {}
    us_aqi = current.get("us_aqi")
    return AirReading(
        source="open-meteo",
        sourceUrl=SOURCE_URL,
        fetchedAt=now_ms(),
        location=location,
        usAqi=us_aqi,
        categoryLabel=aqi_category(us_aqi),
    )


async def fetch_reading(
    location: str, lat: float, lon: float, client: httpx.AsyncClient | None = None
) -> AirReading:
    """Fetch one point query; a failed city raises and degrades the whole feed."""
    response = await (client or get_http_client()).get(
        AQ_URL,
        params={
            "latitude": lat,
            "longitude": lon,
            "current": "us_aqi",
            "timezone": "America/Los_Angeles",
        },
    )
    response.raise_for_status()
    return normalize_reading(location, response.json())


async def fetch_point(
    lat: float, lon: float, client: httpx.AsyncClient | None = None
) -> list[AirReading]:
    """User-geolocation reading, list-wrapped for the envelope contract."""
    return [await fetch_reading("Your location", lat, lon, client)]


async def fetch_reference_readings(client: httpx.AsyncClient | None = None) -> list[AirReading]:
    """One reading per reference city, fetched concurrently (order preserved)."""
    client = client or get_http_client()
    readings = await asyncio.gather(
        *(fetch_reading(name, lat, lon, client) for name, (lat, lon) in REFERENCE_CITIES.items())
    )
    return list(readings)
