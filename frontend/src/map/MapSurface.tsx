/**
 * Surface 1 composition: the live map, the permanent legend, and the synced
 * keyboard-navigable incident list, plus a placeholder detail slot (the full
 * detail view is the next lane). Owns the shared selection state both
 * directions target and exposes it via onSelectIncident.
 */

import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getAlerts, getFires, getPerimeters } from '../api/client'
import { GIBS_SOURCE_URL, NWS_SOURCE_URL, WFIGS_SOURCE_URL } from '../api/sources'
import type { SourceMeta } from '../api/types'
import MapView from './MapView'
import IncidentDetail from '../detail/IncidentDetail'
import { GIBS_FEATURE_FLAG } from './featureFlags'
import IncidentList from './IncidentList'
import Legend from './Legend'
import { feedAge, feedLegendLayer, type LegendLayer } from './legend'
import { useFeed } from './useFeed'
import { LAYER_COLORS } from './maplibre-style'

// Stable identities so the feed effects never re-run spuriously.
const WFIGS_FALLBACK_META: SourceMeta = { source: 'wfigs', sourceUrl: WFIGS_SOURCE_URL, fetchedAt: 0 }
const NWS_FALLBACK_META: SourceMeta = { source: 'nws', sourceUrl: NWS_SOURCE_URL, fetchedAt: 0 }

// Legend swatch for the optional satellite raster (hotspot imagery tone).
const GIBS_SWATCH = '#ff5e15'

export interface MapSurfaceProps {
  /** Lifted selection hook for the next lane's incident detail surface. */
  onSelectIncident?: (incidentId: string | null) => void
}

export default function MapSurface({ onSelectIncident }: MapSurfaceProps = {}) {
  const { t } = useTranslation()
  const fires = useFeed(getFires, WFIGS_FALLBACK_META)
  const perimeters = useFeed(getPerimeters, WFIGS_FALLBACK_META)
  const alerts = useFeed(getAlerts, NWS_FALLBACK_META)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [gibsEnabled, setGibsEnabled] = useState(false)

  const incidents = fires.kind === 'loaded' ? (fires.result.data ?? []) : []
  const perimeterRecords = perimeters.kind === 'loaded' ? (perimeters.result.data ?? []) : []
  const alertRecords = alerts.kind === 'loaded' ? (alerts.result.data ?? []) : []
  const selectedIncident = incidents.find((incident) => incident.incidentId === selectedId) ?? null

  const handleSelect = useCallback(
    (incidentId: string) => {
      setSelectedId(incidentId)
      onSelectIncident?.(incidentId)
    },
    [onSelectIncident],
  )
  const handleDeselect = useCallback(() => {
    setSelectedId(null)
    onSelectIncident?.(null)
  }, [onSelectIncident])

  const allLoaded =
    fires.kind === 'loaded' && perimeters.kind === 'loaded' && alerts.kind === 'loaded'

  // Legend rows: one per layer with source, status, and data age. Computed per
  // render — the clock only needs to be right to the minute.
  const legendLayers = useMemo<LegendLayer[]>(() => {
    const now = Date.now()
    const statusLabels = {
      loading: t('map.loading'),
      live: t('map.statusLive'),
      stale: t('map.statusStale'),
      failed: t('map.statusFailed'),
    }
    const ageLabel = (fetchedAt: number, failed: boolean): string | null => {
      if (failed) return null
      const age = feedAge(fetchedAt, now)
      return t(age.key, age.count !== undefined ? { count: age.count } : undefined)
    }
    const rows: LegendLayer[] = [
      feedLegendLayer({
        id: 'incidents',
        name: t('map.layerIncidents'),
        swatch: LAYER_COLORS.incidents,
        sourceLabel: 'NIFC WFIGS',
        sourceUrl: WFIGS_SOURCE_URL,
        status: fires.kind === 'loaded' ? fires.result.status : 'stale',
        statusLabels,
        ageLabel:
          fires.kind === 'loaded'
            ? ageLabel(fires.result.meta.fetchedAt, fires.result.status === 'failed')
            : null,
      }),
      feedLegendLayer({
        id: 'perimeters',
        name: t('map.layerPerimeters'),
        swatch: LAYER_COLORS.perimeters,
        sourceLabel: 'NIFC WFIGS',
        sourceUrl: WFIGS_SOURCE_URL,
        status: perimeters.kind === 'loaded' ? perimeters.result.status : 'stale',
        statusLabels,
        ageLabel:
          perimeters.kind === 'loaded'
            ? ageLabel(perimeters.result.meta.fetchedAt, perimeters.result.status === 'failed')
            : null,
      }),
      feedLegendLayer({
        id: 'alerts',
        name: t('map.layerAlerts'),
        swatch: LAYER_COLORS.alerts,
        sourceLabel: 'NWS',
        sourceUrl: NWS_SOURCE_URL,
        status: alerts.kind === 'loaded' ? alerts.result.status : 'stale',
        statusLabels,
        ageLabel:
          alerts.kind === 'loaded'
            ? ageLabel(alerts.result.meta.fetchedAt, alerts.result.status === 'failed')
            : null,
      }),
    ]
    if (GIBS_FEATURE_FLAG) {
      rows.push(
        feedLegendLayer({
          id: 'gibs',
          name: t('map.layerGibs'),
          swatch: GIBS_SWATCH,
          sourceLabel: 'NASA GIBS',
          sourceUrl: GIBS_SOURCE_URL,
          // The raster renders straight from NASA WMS — no envelope to degrade.
          status: 'ok',
          statusLabels,
          ageLabel: ageLabel(now - 24 * 60 * 60 * 1000, false),
          note: t('map.legendGibsNote'),
        }),
      )
    }
    return rows
  }, [fires, perimeters, alerts, t])

  return (
    <div className="map-surface">
      <h2>{t('map.title')}</h2>
      <p className="map-surface__intro">{t('map.intro')}</p>
      {GIBS_FEATURE_FLAG ? (
        <label className="map-surface__gibs-toggle">
          <input
            type="checkbox"
            checked={gibsEnabled}
            onChange={(event) => setGibsEnabled(event.target.checked)}
          />
          {t('map.gibsToggleLabel')}
        </label>
      ) : null}
      <div className="map-surface__layout">
        <div className="map-surface__map">
          <MapView
            incidents={incidents}
            perimeters={perimeterRecords}
            alerts={alertRecords}
            selectedId={selectedId}
            onSelect={handleSelect}
            gibsEnabled={gibsEnabled}
          />
        </div>
        <div className="map-surface__side">
          {!allLoaded && <p className="map-surface__loading">{t('map.loading')}</p>}
          <Legend layers={legendLayers} heading={t('map.legendHeading')} />
          <IncidentList
            incidents={incidents}
            selectedId={selectedId}
            onSelect={handleSelect}
            onDeselect={handleDeselect}
            listHeadingId="incident-list-heading"
            labels={{
              heading: t('map.listHeading'),
              count: t('map.listCount', { count: incidents.length }),
              empty: t('map.listEmpty'),
              caption: t('map.listCaption'),
              countyNotReported: t('map.countyNotReported'),
            }}
          />
          {selectedIncident ? (
            <IncidentDetail incident={selectedIncident} />
          ) : (
            <p className="map-surface__no-selection">{t('map.noSelection')}</p>
          )}
        </div>
      </div>
    </div>
  )
}
