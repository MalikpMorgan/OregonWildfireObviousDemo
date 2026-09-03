"""Normalized feed models and the ok / stale / failed envelope.

Mirrors the spec's data-layer contract: every feed client maps its raw feed shape onto
these models, and routes serve FeedResult envelopes — UI code never sees a raw feed shape.
Null tolerance is deliberate: county / acres / containment / geometry are frequently
blank in the feeds and render as "not reported" downstream.
"""

from typing import Any, Literal

from pydantic import BaseModel

SourceName = Literal["wfigs", "nws", "open-meteo", "inciweb", "curated"]


class GeoPolygon(BaseModel):
    """Minimal GeoJSON Polygon geometry (EPSG:4326 lon/lat pairs)."""

    type: Literal["Polygon"] = "Polygon"
    coordinates: list[list[list[float]]]


class SourceMeta(BaseModel):
    """Attribution + freshness — rendered as 'source, updated X min ago'."""

    source: SourceName
    sourceUrl: str
    fetchedAt: int  # epoch ms


class FireIncident(SourceMeta):
    """One active WFIGS incident point (Oregon only)."""

    incidentId: str  # WFIGS Unique Fire Identifier — stable key for the detail view
    name: str
    county: str | None = None
    acres: float | None = None
    containmentPct: float | None = None
    cause: str | None = None
    updatedAt: str | None = None  # the feed's own update time, distinct from fetchedAt
    lat: float
    lon: float
    inciwebId: str | None = None  # joins to the InciWeb RSS narrative


class FirePerimeter(BaseModel):
    """WFIGS interagency perimeter polygons for one incident."""

    incidentId: str
    polygons: list[GeoPolygon]


class FireAlert(SourceMeta):
    """One NWS alert; only fire-relevant events survive the client's filter."""

    nwsId: str
    event: str  # e.g. "Red Flag Warning"
    areaDesc: str
    expires: str | None = None
    geometry: GeoPolygon | None = None  # NWS can publish alerts without geometry


class AirReading(SourceMeta):
    """US AQI for one location (Open-Meteo — a model estimate, not a monitor reading)."""

    location: str
    usAqi: float | None = None
    categoryLabel: str  # text label — meaning never carried by color alone


class IncidentNarrative(SourceMeta):
    """InciWeb narrative summary joined to a WFIGS incident for the detail view."""

    incidentId: str  # the WFIGS UFI the narrative was resolved for
    inciwebId: str  # InciWeb incident code, e.g. "ORMHF"
    title: str
    summary: str
    lastUpdated: str | None = None
    link: str  # official incident page on InciWeb


class FeedResult(BaseModel):
    """The degradation contract every feed route serves.

    "ok" renders live data; "stale" renders last-good data with an age badge;
    "failed" renders a plain-language error plus the official fallback link.
    A failed feed never blanks the page — the other surfaces keep working.
    """

    status: Literal["ok", "stale", "failed"]
    data: list[Any] | None = None
    meta: SourceMeta
    error: str | None = None
