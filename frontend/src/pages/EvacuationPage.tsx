import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { counties } from '../content/counties'
import { evacuation } from '../content/evacuation'
import type { EvacuationLevelColor } from '../content/types'

const LEVEL_CHIP_CLASS: Record<EvacuationLevelColor, string> = {
  green: 'evac-level__chip--green',
  yellow: 'evac-level__chip--yellow',
  red: 'evac-level__chip--red',
}

/** Locale-aware long date for "links verified …" lines. */
function formatReviewDate(isoDate: string, language: string): string {
  return new Intl.DateTimeFormat(language === 'es' ? 'es' : 'en', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${isoDate}T00:00:00`))
}

function EvacuationPage() {
  const { t, i18n } = useTranslation()
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLowerCase()
  const visibleCounties = counties.filter((entry) =>
    entry.county.toLowerCase().includes(normalizedQuery),
  )

  const handleQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value)
  }

  return (
    <section aria-labelledby="evacuation-heading">
      <h2 id="evacuation-heading">{t('evacuation.title')}</h2>
      <p>{t('evacuation.intro')}</p>

      <ol className="evac-levels">
        {evacuation.levels.map((entry) => (
          <li key={entry.level} className="evac-level">
            {/* Color mirrors the official map legend; number + name always carry the meaning. */}
            <span
              className={`evac-level__chip ${LEVEL_CHIP_CLASS[entry.color]}`}
              aria-hidden="true"
            />
            <div>
              <h3>
                {t('evacuation.levelLabel', { level: entry.level })} –{' '}
                {t(`evacuation.levels.${entry.level}.name`)}
              </h3>
              <p>{t(`evacuation.levels.${entry.level}.description`)}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="official-source">
        {t('evacuation.officialSourceLabel')}:{' '}
        <a href={evacuation.officialWordingUrl} target="_blank" rel="noopener noreferrer">
          {evacuation.officialWordingSource}
        </a>
      </p>

      <section className="county-finder" aria-labelledby="county-finder-heading">
        <h3 id="county-finder-heading">{t('evacuation.countyFinder.title')}</h3>
        <p>{t('evacuation.countyFinder.intro')}</p>
        <label className="search-field">
          <span>{t('evacuation.countyFinder.searchLabel')}</span>
          <input
            type="search"
            value={query}
            placeholder={t('evacuation.countyFinder.searchPlaceholder')}
            onChange={handleQueryChange}
          />
        </label>
        <p className="card-meta" aria-live="polite">
          {t('evacuation.countyFinder.count', {
            shown: visibleCounties.length,
            total: counties.length,
          })}
        </p>
        {visibleCounties.length === 0 ? (
          <p className="empty-state">
            {t('evacuation.countyFinder.empty', { query: query.trim() })}
          </p>
        ) : (
          <ul className="county-grid">
            {visibleCounties.map((entry) => (
              <li key={entry.county} className="county-card">
                <h4>{entry.county} County</h4>
                <div className="card-links">
                  {entry.evacuationInfoUrl ? (
                    <a href={entry.evacuationInfoUrl} target="_blank" rel="noopener noreferrer">
                      {t('evacuation.countyFinder.evacuationLink')}
                    </a>
                  ) : (
                    <span className="link-unverified">
                      {t('evacuation.countyFinder.noVerifiedLink')}
                    </span>
                  )}
                  {entry.alertSignupUrl ? (
                    <a href={entry.alertSignupUrl} target="_blank" rel="noopener noreferrer">
                      {t('evacuation.countyFinder.alertLink')}
                    </a>
                  ) : (
                    <span className="link-unverified">
                      {t('evacuation.countyFinder.noVerifiedLink')}
                    </span>
                  )}
                </div>
                <p className="card-meta">
                  {t('evacuation.countyFinder.lastReviewed', {
                    date: formatReviewDate(entry.lastReviewed, i18n.language),
                  })}
                </p>
                <p className="card-meta card-meta--sources">
                  {t('evacuation.countyFinder.sourcesLabel')}: {entry.sources.join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  )
}

export default EvacuationPage
