"""Feed routes — every route serves the FeedResult envelope; a failed upstream never 500s.

Cache keys double as TTL-config names (config.FEED_TTL_DEFAULTS): wfigs_points,
wfigs_perimeters, nws, inciweb, aqi — plus bounded per-point AQI keys.
"""

import functools

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

from app.cache import TTLCache, now_ms
from app.feeds import inciweb, nws, openmeteo, wfigs
from app.feeds.service import load_feed, merge_envelopes
from app.models import FeedResult, FireIncident, IncidentNarrative, SourceMeta

router = APIRouter(prefix="/api")

# Geolocation points are caller-specific — a small FIFO cache bounds memory while
# still sharing last-good data across repeat visits to the same area.
POINT_CACHE = TTLCache(maxsize=512)


async def _attach_inciweb_ids(result: FeedResult) -> None:
    """Join InciWeb codes onto incidents by name (WFIGS has no InciWeb field).

    Best effort by design: a failed InciWeb feed never fails /api/fires — incidents
    just serve with inciwebId null and the detail view links the official page.
    """
    rss = await load_feed(
        "inciweb",
        fetcher=inciweb.fetch_items,
        source="inciweb",
        sourceUrl=inciweb.SOURCE_URL,
    )
    if rss.status == "failed" or not rss.data:
        return
    by_name = {
        inciweb.norm_name(item.name): item.code for item in rss.data if item.code and item.name
    }
    for record in result.data or []:
        if isinstance(record, FireIncident) and record.inciwebId is None:
            record.inciwebId = by_name.get(inciweb.norm_name(record.name))


@router.get("/fires", response_model=FeedResult)
async def fires() -> FeedResult:
    """Oregon incident points (WFIGS), with best-effort InciWeb join for the detail view."""
    result = await load_feed(
        "wfigs_points",
        fetcher=wfigs.fetch_oregon_incidents,
        source="wfigs",
        sourceUrl=wfigs.SOURCE_URL,
    )
    await _attach_inciweb_ids(result)
    return result


@router.get("/perimeters", response_model=FeedResult)
async def perimeters() -> FeedResult:
    """Oregon interagency perimeter polygons (WFIGS), keyed by incident UFI."""
    return await load_feed(
        "wfigs_perimeters",
        fetcher=wfigs.fetch_oregon_perimeters,
        source="wfigs",
        sourceUrl=wfigs.SOURCE_URL,
    )


@router.get("/alerts", response_model=FeedResult)
async def alerts() -> FeedResult:
    """Active Oregon NWS alerts, filtered to fire-relevant events."""
    return await load_feed(
        "nws",
        fetcher=nws.fetch_oregon_alerts,
        source="nws",
        sourceUrl=nws.SOURCE_URL,
    )


@router.get("/aqi", response_model=FeedResult)
async def aqi(
    lat: float | None = Query(default=None, ge=-90, le=90),
    lon: float | None = Query(default=None, ge=-180, le=180),
) -> FeedResult:
    """US AQI for the requested point (geolocation) plus reference cities incl. rural Oregon."""
    if (lat is None) != (lon is None):
        raise HTTPException(status_code=422, detail="Provide both lat and lon, or neither.")
    cities = await load_feed(
        "aqi",
        fetcher=openmeteo.fetch_reference_readings,
        source="open-meteo",
        sourceUrl=openmeteo.SOURCE_URL,
    )
    parts = [cities]
    if lat is not None and lon is not None:
        point = await load_feed(
            f"aqi:point:{lat:.2f}:{lon:.2f}",
            fetcher=functools.partial(openmeteo.fetch_point, lat, lon),
            source="open-meteo",
            sourceUrl=openmeteo.SOURCE_URL,
            ttl_name="aqi",
            cache=POINT_CACHE,
        )
        parts.append(point)
    return merge_envelopes(parts, source="open-meteo", sourceUrl=openmeteo.SOURCE_URL)


@router.get("/incidents/{incident_id}/narrative", response_model=FeedResult)
async def incident_narrative(incident_id: str) -> FeedResult:
    """InciWeb narrative for a WFIGS incident; empty data when the incident has none."""
    fires_result = await load_feed(
        "wfigs_points",
        fetcher=wfigs.fetch_oregon_incidents,
        source="wfigs",
        sourceUrl=wfigs.SOURCE_URL,
    )
    if fires_result.status == "failed":
        return FeedResult(
            status="failed",
            data=None,
            error=f"WFIGS feed unavailable; cannot resolve incident {incident_id}",
            meta=fires_result.meta,
        )
    incident = next(
        (
            record
            for record in fires_result.data or []
            if isinstance(record, FireIncident) and record.incidentId == incident_id
        ),
        None,
    )
    if incident is None:
        return JSONResponse(
            status_code=404,
            content=FeedResult(
                status="failed",
                data=None,
                error=f"Incident {incident_id} not found in current WFIGS data",
                meta=SourceMeta(
                    source="wfigs", sourceUrl=wfigs.SOURCE_URL, fetchedAt=now_ms()
                ),
            ).model_dump(),
        )
    rss = await load_feed(
        "inciweb",
        fetcher=inciweb.fetch_items,
        source="inciweb",
        sourceUrl=inciweb.SOURCE_URL,
    )
    if rss.status == "failed":
        return rss  # narrative unavailable and no last-good copy
    match = inciweb.find_item(incident.name, rss.data or [])
    if match is None:
        # Incident is not on InciWeb — the UI links the official incident page instead.
        return FeedResult(status=rss.status, data=[], meta=rss.meta)
    narrative = IncidentNarrative(
        source="inciweb",
        sourceUrl=inciweb.SOURCE_URL,
        fetchedAt=rss.meta.fetchedAt,
        incidentId=incident.incidentId,
        inciwebId=match.code,
        title=match.title,
        summary=match.summary,
        lastUpdated=match.lastUpdated,
        link=match.link,
    )
    return FeedResult(status=rss.status, data=[narrative], meta=rss.meta)
