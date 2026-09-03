import { useTranslation } from 'react-i18next'
import { reliefCategoryOrder, reliefResources } from '../content/relief'

/** Locale-aware long date for "reviewed …" lines. */
function formatReviewDate(isoDate: string, language: string): string {
  return new Intl.DateTimeFormat(language === 'es' ? 'es' : 'en', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${isoDate}T00:00:00`))
}

function ReliefPage() {
  const { t, i18n } = useTranslation()

  return (
    <section aria-labelledby="relief-heading">
      <h2 id="relief-heading">{t('relief.title')}</h2>
      <p>{t('relief.intro')}</p>

      {reliefCategoryOrder.map((category) => {
        const items = reliefResources.filter((entry) => entry.category === category)
        if (items.length === 0) return null
        return (
          <section
            key={category}
            className="relief-group"
            aria-labelledby={`relief-group-${category}`}
          >
            <h3 id={`relief-group-${category}`}>{t(`relief.groups.${category}`)}</h3>
            <ul className="relief-cards">
              {items.map((entry) => (
                <li key={entry.id} className="relief-card">
                  <h4>{entry.name}</h4>
                  <p>{t(`relief.items.${entry.id}.description`)}</p>
                  <div className="card-links">
                    <a href={entry.url} target="_blank" rel="noopener noreferrer">
                      {t('relief.visitLink', { name: entry.name })}
                    </a>
                    {entry.phone ? (
                      <a href={`tel:${entry.phone}`}>
                        {t('relief.phoneLabel', { phone: entry.phone })}
                      </a>
                    ) : null}
                  </div>
                  <p className="card-meta">
                    {t('relief.lastReviewed', {
                      date: formatReviewDate(entry.lastReviewed, i18n.language),
                    })}
                  </p>
                  <p className="card-meta card-meta--sources">
                    {t('relief.sourcesLabel')}: {entry.sources.join(' · ')}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </section>
  )
}

export default ReliefPage
