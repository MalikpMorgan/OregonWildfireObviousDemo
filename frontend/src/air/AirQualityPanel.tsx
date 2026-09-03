/**
 * Surface 3 — air-quality panel: US AQI for the user's location (geolocation,
 * permission-gated) plus Oregon reference cities including rural communities.
 * Every reading shows the number, a text category (never color-only), a "model
 * estimate" label, and source attribution with timestamps; official monitor
 * context links (Oregon DEQ, OregonSmoke) render in every state. Each envelope
 * status renders its own state — named loading skeleton, live readings with the
 * source line, stale badge, failed notice, or the empty note — and denying
 * geolocation degrades cleanly to the reference cities. The panel never blanks.
 */

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getAqiAt, getAqiReference } from '../api/client'
import { OREGON_DEQ_AQI_URL, OREGON_SMOKE_URL, OPENMETEO_SOURCE_URL } from '../api/sources'
import type { AirReading, FeedResult } from '../api/types'
import { failedEnvelope, useFeed } from '../map/useFeed'
import { feedAge } from '../map/legend'
import { envelopeView } from '../state/envelopeView'
import { FailedNotice, FeedSkeleton, StaleNotice } from '../state/FeedStates'

// Attribution meta for a failed fetch — no feed time to show.
const OPENMETEO_FALLBACK_META = {
  source: 'open-meteo' as const,
  sourceUrl: OPENMETEO_SOURCE_URL,
  fetchedAt: 0,
}

type GeoPhase = 'locating' | 'granted' | 'denied' | 'unavailable' | 'unsupported'

type PointState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; result: FeedResult<AirReading> }

/** One reading card: number, text category, model-estimate label. */
function AirCard({ reading, locationLabel }: { reading: AirReading; locationLabel: string }) {
  const { t } = useTranslation()
  return (
    <li className="aqi-card">
      <span className="aqi-card__location">{locationLabel}</span>
      <span className="aqi-card__row">
        <span className="aqi-card__value">
          {reading.usAqi !== null ? Math.round(reading.usAqi) : t('air.notReported')}
        </span>
        <span className="aqi-card__unit">{t('air.usAqiLabel')}</span>
      </span>
      <span className="aqi-card__category">{reading.categoryLabel}</span>
      <span className="aqi-card__estimate">{t('air.modelEstimate')}</span>
    </li>
  )
}

function OfficialLinks() {
  const { t } = useTranslation()
  return (
    <p className="aqi-panel__official">
      {t('air.officialContext')}{' '}
      <a href={OREGON_DEQ_AQI_URL} target="_blank" rel="noopener noreferrer">
        aqi.oregon.gov
      </a>
      {' · '}
      <a href={OREGON_SMOKE_URL} target="_blank" rel="noopener noreferrer">
        oregonsmoke.org
      </a>
    </p>
  )
}

export default function AirQualityPanel() {
  const { t } = useTranslation()
  const cities = useFeed(getAqiReference, OPENMETEO_FALLBACK_META)
  const [geoPhase, setGeoPhase] = useState<GeoPhase>('locating')
  const [point, setPoint] = useState<PointState>({ kind: 'idle' })

  const locate = useCallback(() => {
    // jsdom and older browsers ship no geolocation — degrade, never crash.
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoPhase('unsupported')
      return
    }
    setGeoPhase('locating')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoPhase('granted')
        setPoint({ kind: 'loading' })
        getAqiAt(position.coords.latitude, position.coords.longitude)()
          .then((result) => setPoint({ kind: 'loaded', result }))
          .catch((error: unknown) => {
            // Network/HTTP failure resolves to the failed envelope — the panel
            // notes it and keeps the reference cities.
            setPoint({ kind: 'loaded', result: failedEnvelope(OPENMETEO_FALLBACK_META, error) })
          })
      },
      (error) => {
        // PERMISSION_DENIED (1) is the user's choice — the other codes mean we
        // simply could not fix a position. Both degrade to reference cities.
        setGeoPhase(error.code === 1 ? 'denied' : 'unavailable')
        setPoint({ kind: 'idle' })
      },
    )
  }, [])

  useEffect(() => {
    locate()
  }, [locate])

  const ageLabel = (fetchedAt: number): string => {
    const age = feedAge(fetchedAt, Date.now())
    return t(age.key, age.count !== undefined ? { count: age.count } : undefined)
  }

  const now = Date.now()
  const citiesView = cities.kind === 'loaded' ? envelopeView(cities.result, now) : null
  const cityReadings = cities.kind === 'loaded' ? (cities.result.data ?? []) : []
  const pointReading = point.kind === 'loaded' && point.result.data?.length ? point.result.data[0] : null
  const pointFailed = point.kind === 'loaded' && pointReading === null
  const pointStaleAge =
    point.kind === 'loaded' && pointReading !== null && point.result.status === 'stale'
      ? ageLabel(point.result.meta.fetchedAt)
      : null

  const geoNote: string | null =
    geoPhase === 'denied'
      ? t('air.geoDenied')
      : geoPhase === 'unavailable'
        ? t('air.geoUnavailable')
        : geoPhase === 'unsupported'
          ? t('air.geoUnsupported')
          : null

  return (
    <section className="aqi-panel" aria-labelledby="aqi-heading" data-testid="aqi-panel">
      <h2 id="aqi-heading">{t('air.title')}</h2>
      <p className="aqi-panel__intro">{t('air.intro')}</p>

      {geoNote ? (
        <p className="aqi-panel__geo-note" role="status">
          {geoNote}{' '}
          {geoPhase !== 'unsupported' ? (
            <button type="button" className="aqi-panel__retry" onClick={locate}>
              {t('air.useMyLocation')}
            </button>
          ) : null}
        </p>
      ) : geoPhase === 'locating' ? (
        <p className="aqi-panel__geo-note" role="status">
          {t('air.locating')}
        </p>
      ) : null}

      {point.kind === 'loading' ? (
        <p className="aqi-panel__note" role="status">
          {t('air.reading')}
        </p>
      ) : pointReading ? (
        <>
          {pointStaleAge ? (
            <StaleNotice ageLabel={pointStaleAge} note={t('state.staleNote')} />
          ) : null}
          <ul className="aqi-panel__grid aqi-panel__grid--single">
            <AirCard reading={pointReading} locationLabel={t('air.yourLocation')} />
          </ul>
        </>
      ) : pointFailed ? (
        <p className="aqi-panel__note" role="alert">
          {t('air.pointFailed')}
        </p>
      ) : null}

      <h3>{t('air.citiesHeading')}</h3>
      {cities.kind === 'loading' ? (
        <FeedSkeleton label={t('air.loading')} />
      ) : citiesView?.kind === 'failed' ? (
        <FailedNotice message={t('air.failed')} />
      ) : citiesView?.kind === 'empty' ? (
        <p className="aqi-panel__note" role="status">
          {t('air.empty')}
        </p>
      ) : (
        <>
          {citiesView?.kind === 'stale' && cities.kind === 'loaded' ? (
            <StaleNotice
              ageLabel={ageLabel(cities.result.meta.fetchedAt)}
              note={t('state.staleNote')}
            />
          ) : null}
          <ul className="aqi-panel__grid">
            {cityReadings.map((reading) => (
              <AirCard key={reading.location} reading={reading} locationLabel={reading.location} />
            ))}
          </ul>
        </>
      )}

      {cities.kind === 'loaded' && cities.result.status !== 'failed' ? (
        <p className="aqi-panel__meta">
          {t('air.sourceLine', { age: ageLabel(cities.result.meta.fetchedAt) })}
        </p>
      ) : null}
      <OfficialLinks />
    </section>
  )
}
