/**
 * Surface 1 composition: the live map, the permanent legend, and the synced
 * keyboard-navigable incident list, plus the incident detail slot. Each feed
 * renders its own envelope state (spec §Behavior & states): a skeleton naming
 * the source while loading, live data with an "updated X ago" stamp, last-good
 * data with a stale badge, a plain error with the official fallback link when
 * failed, and a dated empty state — a failed feed never blanks the panel or
 * takes down the others.
 */

import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getAlerts, getFires, getPerimeters } from '../api/client'
import { GIBS_SOURCE_URL, NWS_SOURCE_URL, WFIGS_SOURCE_URL } from '../api/sources'
import type { SourceMeta } from '../api/types'
import { envelopeView } from '../state/envelopeView'
import type { EnvelopeView } from '../state/envelopeView'
import { FailedNotice, FeedSkeleton, StaleNotice } from '../state/FeedStates'
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

/** The dated healthy-empty state: report date plus the official sources. */
function EmptyIncidents({ asOf }: { asOf: string }) {
  const { t } = useTranslation()
  return (
    <div className="feed-state feed-state--empty" role="status" data-testid="incidents-empty">
      <p className="feed-state__title">{t('map.emptyAsOf', { date: asOf })}</p>
      <p className="feed-state__meta">
        {t('map.emptySourcesLabel')}{' '}
        <a href={WFIGS_SOURCE_URL} target="_blank" rel="noopener noreferrer">
          {t('map.fallbackWfigs')}
        </a>
        {' · '}
        <a href={NWS_SOURCE_URL} target="_blank" rel="noopener noreferrer">
          {t('map.fallbackNws')}
        </a>
      </p>
    </div>
  )
}

export default function MapSurface({ onSelectIncident }: MapSurfaceProps = {}) {
  const { t, i18n } = useTranslation()
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

  // Per-source envelope views — the §Behavior & states matrix for the side panel.
  const now = Date.now()
  const firesView = fires.kind === 'loaded' ? envelopeView(fires.result, now) : null
  const perimetersView = perimeters.kind === 'loaded' ? envelopeView(perimeters.result, now) : null
  const alertsView = alerts.kind === 'loaded' ? envelopeView(alerts.result, now) : null

  const ageLabel = (view: EnvelopeView): string | null => {
    if (!view.age) return null
    return t(view.age.key, view.age.count !== undefined ? { count: view.age.count } : undefined)
  }
  const stampLabel = (view: EnvelopeView): string | null => {
    const age = ageLabel(view)
    return age ? t('map.legendDataAge', { age }) : null
  }
  const longDate = (ms: number): string =>
    new Intl.DateTimeFormat(i18n.language === 'es' ? 'es' : 'en', { dateStyle: 'long' }).format(ms)

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
          <Legend layers={legendLayers} heading={t('map.legendHeading')} />

          {/* Named skeletons — each source resolves independently. */}
          {fires.kind === 'loading' && <FeedSkeleton label={t('map.loadingIncidents')} />}
          {perimeters.kind === 'loading' && <FeedSkeleton label={t('map.loadingPerimeters')} />}
          {alerts.kind === 'loading' && <FeedSkeleton label={t('map.loadingAlerts')} />}

          {/* Perimeters are map-only: a failure degrades to a note, the map stays up. */}
          {perimetersView?.kind === 'failed' && (
            <FailedNotice
              message={t('map.perimetersFailed')}
              linkLabel={t('map.fallbackWfigs')}
              linkHref={WFIGS_SOURCE_URL}
            />
          )}

          {/* Alert feed states — the alerts themselves render as map overlays. */}
          {alertsView?.kind === 'failed' && alerts.kind === 'loaded' && (
            <FailedNotice
              message={t('map.alertsFailed')}
              linkLabel={t('map.fallbackNws')}
              linkHref={NWS_SOURCE_URL}
            />
          )}
          {alertsView?.kind === 'stale' && alerts.kind === 'loaded' && (
            <StaleNotice ageLabel={ageLabel(alertsView) ?? ''} note={t('state.staleNote')} />
          )}
          {alertsView?.kind === 'empty' && (
            <p className="feed-state__stamp" role="status">
              {t('map.alertsEmpty')}
            </p>
          )}

          {/* Incident feed states — the list never fakes emptiness or failure. */}
          {firesView?.kind === 'failed' && fires.kind === 'loaded' && (
            <FailedNotice
              message={t('map.firesFailed')}
              linkLabel={t('map.fallbackWfigs')}
              linkHref={WFIGS_SOURCE_URL}
            />
          )}
          {firesView?.kind === 'empty' && fires.kind === 'loaded' && (
            <EmptyIncidents asOf={longDate(fires.result.meta.fetchedAt)} />
          )}
          {firesView &&
            fires.kind === 'loaded' &&
            (firesView.kind === 'ready' || firesView.kind === 'stale') && (
              <>
                {firesView.kind === 'stale' ? (
                  <StaleNotice ageLabel={ageLabel(firesView) ?? ''} note={t('state.staleNote')} />
                ) : (
                  <p className="feed-state__stamp">{stampLabel(firesView)}</p>
                )}
                <IncidentList
                  incidents={incidents}
                  selectedId={selectedId}
                  onSelect={handleSelect}
                  onDeselect={handleDeselect}
                  listHeadingId="incident-list-heading"
                  labels={{
                    heading: t('map.listHeading'),
                    count: t('map.listCount', { count: incidents.length }),
                    caption: t('map.listCaption'),
                    countyNotReported: t('map.countyNotReported'),
                  }}
                />
              </>
            )}
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
