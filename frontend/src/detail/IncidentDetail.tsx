/**
 * Surface 2 — incident detail panel: the feed's own facts (name, county, acres,
 * containment, cause, update time) with nulls rendered as "not reported", the
 * InciWeb narrative when the incident joins one, and an official-page link when
 * it doesn't (or the narrative feed fails). A missing narrative never blanks
 * the panel.
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getNarrative } from '../api/client'
import { INCIWEB_SOURCE_URL, WFIGS_SOURCE_URL } from '../api/sources'
import type { FeedResult, FireIncident, IncidentNarrative } from '../api/types'
import { failedEnvelope } from '../map/useFeed'
import { feedAge } from '../map/legend'
import { formatAcres, formatFeedUpdate } from '../map/format'
import { StaleNotice } from '../state/FeedStates'

type NarrativeState =
  | { kind: 'loading' }
  | { kind: 'loaded'; result: FeedResult<IncidentNarrative> }

// Attribution meta for a failed narrative fetch — no feed time to show.
const NARRATIVE_FAILED_META = { source: 'inciweb' as const, sourceUrl: INCIWEB_SOURCE_URL, fetchedAt: 0 }

export default function IncidentDetail({ incident }: { incident: FireIncident }) {
  const { t, i18n } = useTranslation()
  const [narrative, setNarrative] = useState<NarrativeState>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    setNarrative({ kind: 'loading' })
    getNarrative(incident.incidentId)
      .then((result) => {
        if (!cancelled) setNarrative({ kind: 'loaded', result })
      })
      .catch((error: unknown) => {
        // Network/HTTP failure resolves to the failed envelope — the panel
        // shows the official-page link, never an error boundary.
        if (!cancelled) {
          setNarrative({ kind: 'loaded', result: failedEnvelope(NARRATIVE_FAILED_META, error) })
        }
      })
    return () => {
      cancelled = true
    }
  }, [incident.incidentId])

  const notReported = t('map.notReported')
  const acres = formatAcres(incident.acres)
  const feedUpdate = formatFeedUpdate(incident.updatedAt, i18n.language)

  const ageLabel = (fetchedAt: number): string => {
    const age = feedAge(fetchedAt, Date.now())
    return t(age.key, age.count !== undefined ? { count: age.count } : undefined)
  }

  const fields: { label: string; value: string }[] = [
    { label: t('map.county'), value: incident.county ?? notReported },
    { label: t('map.acres'), value: acres ?? notReported },
    {
      label: t('map.containment'),
      value: incident.containmentPct !== null ? t('detail.containmentValue', { pct: incident.containmentPct }) : notReported,
    },
    { label: t('map.cause'), value: incident.cause ?? notReported },
    { label: t('map.updated'), value: feedUpdate ?? notReported },
  ]

  const narrativeRecord =
    narrative.kind === 'loaded' && narrative.result.data?.length
      ? narrative.result.data[0]
      : null
  const narrativeFailed =
    narrative.kind === 'loaded' && (narrative.result.status === 'failed' || narrative.result.data === null)

  return (
    <section className="incident-detail" data-testid="incident-detail" aria-label={t('detail.heading')}>
      <h3>{t('detail.heading')}</h3>
      <p className="incident-detail__name">{incident.name}</p>
      <dl className="incident-detail__facts">
        {fields.map((field) => (
          <div key={field.label} className="incident-detail__fact">
            <dt>{field.label}</dt>
            <dd>{field.value}</dd>
          </div>
        ))}
      </dl>

      {narrative.kind === 'loading' ? (
        <p className="incident-detail__note" role="status">
          {t('detail.narrativeLoading')}
        </p>
      ) : narrativeRecord ? (
        <div className="incident-detail__narrative">
          <h4>{t('detail.narrativeHeading')}</h4>
          {narrative.kind === 'loaded' && narrative.result.status === 'stale' ? (
            <StaleNotice
              ageLabel={ageLabel(narrative.result.meta.fetchedAt)}
              note={t('state.staleNote')}
            />
          ) : null}
          <p className="incident-detail__summary">{narrativeRecord.summary}</p>
          {narrativeRecord.lastUpdated ? (
            <p className="incident-detail__meta">
              {t('detail.narrativeLastUpdated', { date: narrativeRecord.lastUpdated })}
            </p>
          ) : null}
          <p className="incident-detail__meta">
            <a href={narrativeRecord.link} target="_blank" rel="noopener noreferrer">
              {t('detail.readNarrative')}
            </a>
            {' · '}
            {t('detail.narrativeSourceAttribution', {
              age: ageLabel(narrative.result.meta.fetchedAt),
            })}
          </p>
        </div>
      ) : (
        <div className="incident-detail__narrative">
          <p className="incident-detail__note">
            {narrativeFailed ? t('detail.narrativeFailed') : t('detail.narrativeMissing')}
          </p>
          <p className="incident-detail__meta">
            <a href={INCIWEB_SOURCE_URL} target="_blank" rel="noopener noreferrer">
              {t('detail.officialFallback')}
            </a>
          </p>
        </div>
      )}

      <p className="incident-detail__meta">
        {t('detail.sourceAttribution', { age: ageLabel(incident.fetchedAt) })} ·{' '}
        <a href={WFIGS_SOURCE_URL} target="_blank" rel="noopener noreferrer">
          {t('map.fallbackWfigs')}
        </a>
      </p>
    </section>
  )
}
