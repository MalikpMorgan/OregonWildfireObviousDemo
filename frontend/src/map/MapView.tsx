/**
 * MapLibre GL wrapper: WFIGS incident points, perimeter polygons, and NWS alert
 * polygons as GeoJSON layers over a keyless basemap, plus the feature-flagged
 * GIBS raster. Data flows in from the API envelopes; selection flows in from the
 * list view and out via map clicks — the two directions stay in sync.
 */

import {
  type GeoJSONSource,
  Map as MaplibreMap,
  NavigationControl,
  Popup as MaplibrePopup,
  type Source,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { FireAlert, FireIncident, FirePerimeter } from '../api/types'
import {
  ALERTS_FILL_LAYER,
  ALERTS_LINE_LAYER,
  ALERTS_SOURCE,
  BASEMAP_STYLE_URL,
  EMPTY_COLLECTION,
  GIBS_LAYER,
  GIBS_SOURCE,
  INCIDENTS_LAYER,
  INCIDENTS_SELECTED_LAYER,
  INCIDENTS_SOURCE,
  LAYER_COLORS,
  OREGON_CENTER,
  OREGON_ZOOM,
  PERIMETERS_FILL_LAYER,
  PERIMETERS_LINE_LAYER,
  PERIMETERS_SOURCE,
  SELECTED_ZOOM,
  alertsWithGeometryToGeoJson,
  gibsRasterSource,
  gibsYesterdayUtc,
  incidentsToGeoJson,
  perimetersToGeoJson,
} from './maplibre-style'
import { incidentTooltipHtml } from './format'

interface MapViewProps {
  incidents: FireIncident[]
  perimeters: FirePerimeter[]
  alerts: FireAlert[]
  selectedId: string | null
  onSelect: (incidentId: string) => void
  gibsEnabled: boolean
}

/** GeoJSON sources expose setData; raster/vector sources do not. */
function isGeoJsonSource(source: Source | undefined): source is GeoJSONSource {
  return source !== undefined && 'setData' in source
}

export default function MapView({
  incidents,
  perimeters,
  alerts,
  selectedId,
  onSelect,
  gibsEnabled,
}: MapViewProps) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MaplibreMap | null>(null)
  const popupRef = useRef<MaplibrePopup | null>(null)
  const onSelectRef = useRef(onSelect)
  const [layersReady, setLayersReady] = useState(false)

  onSelectRef.current = onSelect

  const tooltipLabels = useMemo(
    () => ({
      county: t('map.county'),
      updated: t('map.updated'),
      countyNotReported: t('map.countyNotReported'),
      updatedNever: t('map.notReported'),
    }),
    [t],
  )

  // Mount once: create the map, then add sources and layers when the style loads.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const map = new MaplibreMap({
      container,
      style: BASEMAP_STYLE_URL,
      center: OREGON_CENTER,
      zoom: OREGON_ZOOM,
    })
    mapRef.current = map
    map.addControl(new NavigationControl(), 'top-right')
    // Tile/style errors surface in the console and on the basemap — visible, not fatal.
    map.on('error', (event) => {
      console.error('[MapView] maplibre error', event)
    })
    map.on('load', () => {
      map.addSource(PERIMETERS_SOURCE, { type: 'geojson', data: EMPTY_COLLECTION })
      map.addSource(ALERTS_SOURCE, { type: 'geojson', data: EMPTY_COLLECTION })
      map.addSource(INCIDENTS_SOURCE, { type: 'geojson', data: EMPTY_COLLECTION })

      map.addLayer({
        id: PERIMETERS_FILL_LAYER,
        type: 'fill',
        source: PERIMETERS_SOURCE,
        paint: { 'fill-color': LAYER_COLORS.perimeters, 'fill-opacity': 0.3 },
      })
      map.addLayer({
        id: PERIMETERS_LINE_LAYER,
        type: 'line',
        source: PERIMETERS_SOURCE,
        paint: { 'line-color': LAYER_COLORS.perimeters, 'line-width': 2 },
      })
      map.addLayer({
        id: ALERTS_FILL_LAYER,
        type: 'fill',
        source: ALERTS_SOURCE,
        paint: { 'fill-color': LAYER_COLORS.alerts, 'fill-opacity': 0.18 },
      })
      map.addLayer({
        id: ALERTS_LINE_LAYER,
        type: 'line',
        source: ALERTS_SOURCE,
        paint: {
          'line-color': LAYER_COLORS.alerts,
          'line-width': 1.5,
          'line-dasharray': [2, 2],
        },
      })
      map.addLayer({
        id: INCIDENTS_LAYER,
        type: 'circle',
        source: INCIDENTS_SOURCE,
        paint: {
          'circle-radius': 7,
          'circle-color': LAYER_COLORS.incidents,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.5,
        },
      })
      map.addLayer({
        id: INCIDENTS_SELECTED_LAYER,
        type: 'circle',
        source: INCIDENTS_SOURCE,
        paint: {
          'circle-radius': 12,
          'circle-color': 'transparent',
          'circle-stroke-color': LAYER_COLORS.incidents,
          'circle-stroke-width': 3,
        },
        filter: ['==', ['get', 'id'], '__none__'],
      })

      map.on('click', INCIDENTS_LAYER, (event) => {
        const id = event.features?.[0]?.properties?.id
        if (typeof id === 'string') onSelectRef.current(id)
      })

      setLayersReady(true)
    })
    return () => {
      popupRef.current = null
      map.remove()
      mapRef.current = null
      setLayersReady(false)
    }
  }, [])

  // Push envelope data into the GeoJSON sources whenever it changes.
  useEffect(() => {
    const map = mapRef.current
    if (!layersReady || !map) return
    const perimetersSource = map.getSource(PERIMETERS_SOURCE)
    if (isGeoJsonSource(perimetersSource)) perimetersSource.setData(perimetersToGeoJson(perimeters))
    const alertsSource = map.getSource(ALERTS_SOURCE)
    if (isGeoJsonSource(alertsSource)) alertsSource.setData(alertsWithGeometryToGeoJson(alerts))
    const incidentsSource = map.getSource(INCIDENTS_SOURCE)
    if (isGeoJsonSource(incidentsSource)) incidentsSource.setData(incidentsToGeoJson(incidents))
  }, [layersReady, incidents, perimeters, alerts])

  // Selection: ring the point, fly in from the list direction, show the tooltip.
  useEffect(() => {
    const map = mapRef.current
    if (!layersReady || !map) return
    map.setFilter(INCIDENTS_SELECTED_LAYER, ['==', ['get', 'id'], selectedId ?? '__none__'])
    if (!selectedId) {
      popupRef.current?.remove()
      popupRef.current = null
      return
    }
    const incident = incidents.find((candidate) => candidate.incidentId === selectedId)
    if (!incident) return
    popupRef.current?.remove()
    popupRef.current = new MaplibrePopup({ offset: 14 })
      .setLngLat([incident.lon, incident.lat])
      .setHTML(incidentTooltipHtml(incident, tooltipLabels))
      .addTo(map)
    if (map.getZoom() < SELECTED_ZOOM) {
      map.flyTo({ center: [incident.lon, incident.lat], zoom: SELECTED_ZOOM, speed: 1.2 })
    }
  }, [layersReady, selectedId, incidents, tooltipLabels])

  // Feature-flagged satellite layer: add/remove the raster in place.
  useEffect(() => {
    const map = mapRef.current
    if (!layersReady || !map) return
    if (gibsEnabled && !map.getLayer(GIBS_LAYER)) {
      map.addSource(GIBS_SOURCE, gibsRasterSource(gibsYesterdayUtc(Date.now())))
      map.addLayer(
        { id: GIBS_LAYER, type: 'raster', source: GIBS_SOURCE, paint: { 'raster-opacity': 0.8 } },
        PERIMETERS_FILL_LAYER,
      )
    } else if (!gibsEnabled && map.getLayer(GIBS_LAYER)) {
      map.removeLayer(GIBS_LAYER)
      map.removeSource(GIBS_SOURCE)
    }
  }, [gibsEnabled, layersReady])

  return (
    <div ref={containerRef} className="map-view" role="application" aria-label={t('map.title')} />
  )
}
