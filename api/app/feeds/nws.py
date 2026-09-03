"""NWS api.weather.gov active-alerts client (research artifact §1.1).

``?area=OR`` returns GeoJSON; pagination params are rejected (``limit`` returns HTTP
400 — live-verified 2026-09-03), so the feed is fetched whole and fire-relevance
filtering happens here in the normalizer, never in UI code.
"""

from typing import Any

import httpx

from app.cache import now_ms
from app.feeds import get_http_client
from app.models import FireAlert, GeoPolygon

ALERTS_URL = "https://api.weather.gov/alerts/active"
SOURCE_URL = "https://api.weather.gov/alerts/active?area=OR"


def is_fire_relevant(event: str) -> bool:
    """The v1 fire-weather vocabulary: Red Flag Warnings and fire-weather watches."""
    normalized = (event or "").lower()
    return "red flag" in normalized or "fire weather" in normalized


def _polygon(geometry: dict[str, Any] | None) -> GeoPolygon | None:
    """NWS can publish alerts without geometry (zone-based) — tolerate nulls."""
    if not geometry or geometry.get("type") != "Polygon":
        return None
    coords = geometry.get("coordinates") or []
    return GeoPolygon(coordinates=coords) if coords else None


def normalize_alert(feature: dict[str, Any]) -> FireAlert | None:
    """Map one NWS GeoJSON alert; None when the feature lacks an id or event."""
    props = feature.get("properties") or {}
    nws_id = props.get("id") or feature.get("id")
    event = props.get("event") or ""
    if not nws_id or not event:
        return None
    return FireAlert(
        source="nws",
        sourceUrl=SOURCE_URL,
        fetchedAt=now_ms(),
        nwsId=str(nws_id),
        event=event,
        areaDesc=props.get("areaDesc") or "",
        expires=props.get("expires"),
        geometry=_polygon(feature.get("geometry")),
    )


async def fetch_oregon_alerts(client: httpx.AsyncClient | None = None) -> list[FireAlert]:
    """Active Oregon alerts, filtered to fire-relevant events. No ``limit`` param — it 400s."""
    response = await (client or get_http_client()).get(ALERTS_URL, params={"area": "OR"})
    response.raise_for_status()
    features = response.json().get("features", [])
    alerts: list[FireAlert] = []
    for feature in features:
        alert = normalize_alert(feature)
        if alert is not None and is_fire_relevant(alert.event):
            alerts.append(alert)
    return alerts
