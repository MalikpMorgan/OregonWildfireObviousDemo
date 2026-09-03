/**
 * TypeScript mirror of the FastAPI feed contract (api/app/models.py).
 *
 * Every route serves a FeedResult envelope; UI code never sees a raw feed shape.
 * Null tolerance is deliberate — county / acres / containment / geometry are
 * frequently blank upstream and render as "not reported" downstream.
 */

export type SourceName = 'wfigs' | 'nws' | 'open-meteo' | 'inciweb' | 'curated'

export type FeedStatus = 'ok' | 'stale' | 'failed'

/** Attribution + freshness — rendered as "source, updated X min ago". */
export interface SourceMeta {
  source: SourceName
  sourceUrl: string
  /** Epoch milliseconds when the API last got good data from the upstream feed. */
  fetchedAt: number
}

/** Minimal GeoJSON Polygon geometry (EPSG:4326 lon/lat pairs). */
export interface GeoPolygon {
  type: 'Polygon'
  coordinates: number[][][]
}

/** One active WFIGS incident point (Oregon only). */
export interface FireIncident extends SourceMeta {
  /** WFIGS Unique Fire Identifier — stable join key across feeds. */
  incidentId: string
  name: string
  county: string | null
  acres: number | null
  containmentPct: number | null
  cause: string | null
  /** The feed's own update time (ISO 8601), distinct from fetchedAt. */
  updatedAt: string | null
  lat: number
  lon: number
  /** Joins to the InciWeb narrative for the detail view; null when unresolvable. */
  inciwebId: string | null
}

/** WFIGS interagency perimeter polygons for one incident. */
export interface FirePerimeter {
  incidentId: string
  polygons: GeoPolygon[]
}

/** One NWS fire-relevant alert; geometry is null for zone-based alerts. */
export interface FireAlert extends SourceMeta {
  nwsId: string
  event: string
  areaDesc: string
  expires: string | null
  geometry: GeoPolygon | null
}

/** The degradation contract every feed route serves. */
export interface FeedResult<T> {
  status: FeedStatus
  data: T[] | null
  meta: SourceMeta
  error?: string | null
}

/** US AQI for one location (Open-Meteo — a model estimate, not a monitor reading). */
export interface AirReading extends SourceMeta {
  location: string
  usAqi: number | null
  /** Text label — meaning never carried by color alone. */
  categoryLabel: string
}

/** InciWeb narrative summary joined to a WFIGS incident for the detail view. */
export interface IncidentNarrative extends SourceMeta {
  /** The WFIGS UFI the narrative was resolved for. */
  incidentId: string
  /** InciWeb incident code, e.g. "ORMHF". */
  inciwebId: string
  title: string
  summary: string
  lastUpdated: string | null
  /** Official incident page on InciWeb. */
  link: string
}
