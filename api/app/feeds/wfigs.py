"""NIFC WFIGS ArcGIS FeatureServer clients — incident points + interagency perimeters.

Live-verified 2026-09-03 (research artifact §1.2; re-verified while recording fixtures):
- ``POOState`` is ISO-style ``US-OR`` — the naive ``'OR'`` filter matches zero rows.
- The incident-locations layer ships NAD83 / EPSG:4269 — queries pass ``outSR=4326``.
- Guessed ``outFields`` names return HTTP 400 — ``outFields=*`` and trimming happens
  here in the normalizer, never in UI code.
"""

from datetime import UTC, datetime
from typing import Any

import httpx

from app.cache import now_ms
from app.feeds import get_http_client
from app.models import FireIncident, FirePerimeter, GeoPolygon

ORG = "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services"
INCIDENTS_URL = f"{ORG}/WFIGS_Incident_Locations_Current/FeatureServer/0/query"
PERIMETERS_URL = f"{ORG}/WFIGS_Interagency_Perimeters_Current/FeatureServer/0/query"
SOURCE_URL = "https://data-nifc.opendata.arcgis.com/"  # official NIFC open-data portal


def epoch_ms_to_iso(ms: float | None) -> str | None:
    """WFIGS ``*_dt`` fields are epoch milliseconds — serve ISO 8601 UTC."""
    if ms is None:
        return None
    stamp = datetime.fromtimestamp(ms / 1000, tz=UTC)
    return stamp.isoformat().replace("+00:00", "Z")


def _point(geometry: dict[str, Any] | None) -> tuple[float, float] | None:
    """Extract (lon, lat) from a GeoJSON Point; None when the feature has no fix."""
    if not geometry or geometry.get("type") != "Point":
        return None
    coords = geometry.get("coordinates") or []
    if len(coords) < 2:
        return None
    return float(coords[0]), float(coords[1])


def normalize_incident(feature: dict[str, Any]) -> FireIncident | None:
    """Map one WFIGS point feature; None when the feature has no usable key or fix.

    Null tolerance: county / acres / containment / cause are frequently blank in WFIGS
    and pass through as None ("not reported" in the UI).
    """
    props = feature.get("properties") or {}
    point = _point(feature.get("geometry"))
    if point is None:
        return None
    # Unique Fire Identifier is the join key; IrwinID is the stable fallback.
    incident_id = props.get("UniqueFireIdentifier") or props.get("IrwinID")
    if not incident_id:
        return None
    # IncidentSize is the current reported size; DiscoveryAcres only fills when absent.
    acres = props.get("IncidentSize")
    if acres is None:
        acres = props.get("DiscoveryAcres")
    return FireIncident(
        source="wfigs",
        sourceUrl=SOURCE_URL,
        fetchedAt=now_ms(),
        incidentId=str(incident_id),
        name=props.get("IncidentName") or "(unnamed incident)",
        county=props.get("POOCounty"),
        acres=acres,
        containmentPct=props.get("PercentContained"),
        cause=props.get("FireCause"),
        updatedAt=epoch_ms_to_iso(props.get("ModifiedOnDateTime_dt")),
        lat=point[1],
        lon=point[0],
    )


def _polygons(geometry: dict[str, Any] | None) -> list[GeoPolygon]:
    """Polygon / MultiPolygon GeoJSON -> Polygon models (MultiPolygon split into parts)."""
    if not geometry:
        return []
    geom_type = geometry.get("type")
    coords = geometry.get("coordinates") or []
    if geom_type == "Polygon" and coords:
        return [GeoPolygon(coordinates=coords)]
    if geom_type == "MultiPolygon":
        return [GeoPolygon(coordinates=poly) for poly in coords if poly]
    return []


def normalize_perimeter(feature: dict[str, Any]) -> FirePerimeter | None:
    """Map one perimeter feature to its incident via the UFI attribute.

    The perimeters layer prefixes its schema (``attr_``/``poly_``); its incident key is
    ``attr_UniqueFireIdentifier`` — the same UFI the points layer publishes. Features
    without a key or geometry cannot join and are skipped.
    """
    props = feature.get("properties") or {}
    incident_id = props.get("attr_UniqueFireIdentifier") or props.get("attr_IrwinID")
    polygons = _polygons(feature.get("geometry"))
    if not incident_id or not polygons:
        return None
    return FirePerimeter(incidentId=str(incident_id), polygons=polygons)


async def _query_features(
    url: str, params: dict[str, str], client: httpx.AsyncClient | None
) -> list[dict[str, Any]]:
    response = await (client or get_http_client()).get(url, params=params)
    response.raise_for_status()
    return response.json().get("features", [])


async def fetch_oregon_incidents(client: httpx.AsyncClient | None = None) -> list[FireIncident]:
    """Oregon incident points, normalized (query parameters live-verified)."""
    params = {
        "where": "POOState = 'US-OR'",  # US-OR, not 'OR' — the naive filter returns 0 rows
        "outFields": "*",  # trim here after schema review; guessed names return HTTP 400
        "outSR": "4326",  # layer ships NAD83 / EPSG:4269 — reproject before rendering
        "f": "geojson",
    }
    features = await _query_features(INCIDENTS_URL, params, client)
    return [hit for f in features if (hit := normalize_incident(f)) is not None]


async def fetch_oregon_perimeters(client: httpx.AsyncClient | None = None) -> list[FirePerimeter]:
    """Oregon perimeter polygons (server-side OR filter; layer is natively EPSG:4326)."""
    params = {
        "where": "attr_POOState='US-OR'",  # unprefixed field name silently matches 0 rows
        "outFields": "*",
        "outSR": "4326",  # explicit lon/lat for the GeoJSON renderer
        "f": "geojson",
    }
    features = await _query_features(PERIMETERS_URL, params, client)
    return [hit for f in features if (hit := normalize_perimeter(f)) is not None]
