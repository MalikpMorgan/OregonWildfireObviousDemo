/**
 * Map style constants, GeoJSON builders, and the optional GIBS raster source.
 *
 * Basemap: CARTO "Positron" GL style — keyless, CORS-open (style URL returns 200).
 * GIBS: WMS GetMap for MODIS Terra Thermal Anomalies — the research artifact's
 * live-verified path (§1.6, verification log #13: HTTP 200 image/png).
 */

import { setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import type { FireAlert, FireIncident, FirePerimeter } from '../api/types'

// MapLibre v6 resolves its tile worker next to the bundler's module URL, which
// Vite never co-deploys — without this the worker 404s and no tiles ever load.
// The pair is served verbatim from public/maplibre (refreshed by the copy
// script whenever maplibre-gl is upgraded).
setWorkerUrl(workerUrl)

export const BASEMAP_STYLE_URL = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'

/** Overlooks the whole state; selection flies in from here. */
export const OREGON_CENTER: [number, number] = [-120.55, 43.9]
export const OREGON_ZOOM = 6
export const SELECTED_ZOOM = 8

export const INCIDENTS_SOURCE = 'wfigs-incident-points'
export const PERIMETERS_SOURCE = 'wfigs-perimeters'
export const ALERTS_SOURCE = 'nws-alert-polygons'
export const GIBS_SOURCE = 'nasa-gibs-thermal-anomalies'

export const INCIDENTS_LAYER = 'incidents-circle'
export const INCIDENTS_SELECTED_LAYER = 'incidents-selected-circle'
export const PERIMETERS_FILL_LAYER = 'perimeters-fill'
export const PERIMETERS_LINE_LAYER = 'perimeters-line'
export const ALERTS_FILL_LAYER = 'alerts-fill'
export const ALERTS_LINE_LAYER = 'alerts-line'
export const GIBS_LAYER = 'gibs-thermal-anomalies'

/** Legend swatches mirror these exact paint colors. */
export const LAYER_COLORS = {
  incidents: '#d9480f',
  perimeters: '#f59f00',
  alerts: '#c2255c',
  gibs: '#ff6d00',
} as const

export interface PointFeature {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: { id: string; name: string }
}

export interface PolygonFeature {
  type: 'Feature'
  geometry: { type: 'Polygon'; coordinates: number[][][] }
  properties: { incidentId?: string; nwsId?: string; event?: string }
}

export interface FeatureCollectionOf<F> {
  type: 'FeatureCollection'
  features: F[]
}

type AnyFeatureCollection = FeatureCollectionOf<PointFeature | PolygonFeature>

export const EMPTY_COLLECTION: FeatureCollectionOf<never> = {
  type: 'FeatureCollection',
  features: [],
}

export function incidentsToGeoJson(incidents: FireIncident[]): FeatureCollectionOf<PointFeature> {
  return {
    type: 'FeatureCollection',
    features: incidents.map((incident) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [incident.lon, incident.lat] },
      properties: { id: incident.incidentId, name: incident.name },
    })),
  }
}

export function perimetersToGeoJson(
  perimeters: FirePerimeter[],
): FeatureCollectionOf<PolygonFeature> {
  return {
    type: 'FeatureCollection',
    features: perimeters.flatMap((perimeter) =>
      perimeter.polygons.map((polygon) => ({
        type: 'Feature' as const,
        geometry: { type: 'Polygon' as const, coordinates: polygon.coordinates },
        properties: { incidentId: perimeter.incidentId },
      })),
    ),
  }
}

/** Zone-based alerts (null geometry) have no map area and are dropped here; the
 * list view still shows them. */
export function alertsWithGeometryToGeoJson(alerts: FireAlert[]): FeatureCollectionOf<PolygonFeature> {
  return {
    type: 'FeatureCollection',
    features: alerts.flatMap((alert) =>
      alert.geometry === null
        ? []
        : [
            {
              type: 'Feature' as const,
              geometry: { type: 'Polygon' as const, coordinates: alert.geometry.coordinates },
              properties: { nwsId: alert.nwsId, event: alert.event },
            },
          ],
    ),
  }
}

export type SourceSpecificationLike =
  | { type: 'geojson'; data: AnyFeatureCollection }
  | { type: 'raster'; tiles: string[]; tileSize: number; attribution: string }

/** WMS GetMap tile template — MapLibre substitutes {bbox-epsg-3857} per tile. */
export function gibsWmsTileUrl(timeIsoDate: string): string {
  return (
    'https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi' +
    '?SERVICE=WMS&REQUEST=GetMap&VERSION=1.1.1&LAYERS=MODIS_Terra_Thermal_Anomalies_All' +
    '&SRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png' +
    `&TIME=${timeIsoDate}`
  )
}

/** Thermal-anomaly composites are reliable for the previous UTC day. */
export function gibsYesterdayUtc(nowMs: number): string {
  return new Date(nowMs - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export function gibsRasterSource(timeIsoDate: string): SourceSpecificationLike {
  return {
    type: 'raster',
    tiles: [gibsWmsTileUrl(timeIsoDate)],
    tileSize: 256,
    attribution: 'NASA GIBS / MODIS Terra Thermal Anomalies',
  }
}
