/**
 * Surface 1 composition: the live map plus (in later commits) the legend and the
 * synced incident list. Owns the shared selection state both directions target.
 */

import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getAlerts, getFires, getPerimeters } from '../api/client'
import type { SourceMeta } from '../api/types'
import { NWS_SOURCE_URL, WFIGS_SOURCE_URL } from '../api/fixtures'
import MapView from './MapView'
import { GIBS_FEATURE_FLAG } from './featureFlags'
import { useFeed } from './useFeed'

// Stable identities so the feed effects never re-run spuriously.
const WFIGS_FALLBACK_META: SourceMeta = { source: 'wfigs', sourceUrl: WFIGS_SOURCE_URL, fetchedAt: 0 }
const NWS_FALLBACK_META: SourceMeta = { source: 'nws', sourceUrl: NWS_SOURCE_URL, fetchedAt: 0 }

export default function MapSurface() {
  const { t } = useTranslation()
  const fires = useFeed(getFires, WFIGS_FALLBACK_META)
  const perimeters = useFeed(getPerimeters, WFIGS_FALLBACK_META)
  const alerts = useFeed(getAlerts, NWS_FALLBACK_META)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [gibsEnabled, setGibsEnabled] = useState(false)

  const incidents = fires.kind === 'loaded' ? (fires.result.data ?? []) : []
  const perimeterRecords = perimeters.kind === 'loaded' ? (perimeters.result.data ?? []) : []
  const alertRecords = alerts.kind === 'loaded' ? (alerts.result.data ?? []) : []
  const handleSelect = useCallback((id: string) => setSelectedId(id), [])

  const allLoaded = fires.kind === 'loaded' && perimeters.kind === 'loaded' && alerts.kind === 'loaded'

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
        <div className="map-surface__side" aria-live="polite">
          {allLoaded ? null : <p className="map-surface__loading">{t('map.loading')}</p>}
        </div>
      </div>
    </div>
  )
}
