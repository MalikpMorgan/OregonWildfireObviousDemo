import { useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import MapSurface from './map/MapSurface'
import AirQualityPanel from './air/AirQualityPanel'
import EvacuationPage from './pages/EvacuationPage'
import ReliefPage from './pages/ReliefPage'
import OfflineBanner from './state/OfflineBanner'

// The live fire map is the dashboard's primary surface; evacuation and relief
// remain sibling tabs.
const SURFACES = ['map', 'evacuation', 'relief'] as const
type SurfaceKey = (typeof SURFACES)[number]

function App() {
  const { t, i18n } = useTranslation()
  const [activeSurface, setActiveSurface] = useState<SurfaceKey>('map')
  const tabRefs = useRef<Partial<Record<SurfaceKey, HTMLButtonElement | null>>>({})

  // ARIA tabs pattern: arrow keys move both selection and focus (roving tabindex).
  const focusAndSelect = (surface: SurfaceKey) => {
    setActiveSurface(surface)
    tabRefs.current[surface]?.focus()
  }

  const handleTablistKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const index = SURFACES.indexOf(activeSurface)
    const step = event.key === 'ArrowRight' ? 1 : -1
    focusAndSelect(SURFACES[(index + step + SURFACES.length) % SURFACES.length])
  }

  const switchLanguage = (language: 'en' | 'es') => {
    void i18n.changeLanguage(language)
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {t('app.skipToMain')}
      </a>
      <header>
        <div className="app-header-row">
          <div>
            <h1>{t('app.title')}</h1>
            <p className="app-shell__tagline">{t('app.tagline')}</p>
          </div>
          <div role="group" aria-label={t('app.languageLabel')} className="lang-toggle">
            <button
              type="button"
              aria-pressed={i18n.language === 'en'}
              onClick={() => switchLanguage('en')}
            >
              EN
            </button>
            <button
              type="button"
              aria-pressed={i18n.language === 'es'}
              onClick={() => switchLanguage('es')}
            >
              ES
            </button>
          </div>
        </div>
      </header>
      {/* Offline shell: says what still works and keeps 2-1-1 one tap away. */}
      <OfflineBanner />
      <div
        role="tablist"
        aria-label={t('nav.label')}
        className="tabs"
        onKeyDown={handleTablistKeyDown}
      >
        {SURFACES.map((surface) => (
          <button
            key={surface}
            ref={(node) => {
              tabRefs.current[surface] = node
            }}
            type="button"
            role="tab"
            id={`tab-${surface}`}
            className="tab"
            aria-selected={activeSurface === surface}
            aria-controls={`panel-${surface}`}
            tabIndex={activeSurface === surface ? 0 : -1}
            onClick={() => setActiveSurface(surface)}
          >
            {t(`nav.${surface}`)}
          </button>
        ))}
      </div>
      <main id="main-content">
        <div role="tabpanel" id={`panel-${activeSurface}`} aria-labelledby={`tab-${activeSurface}`}>
          {activeSurface === 'map' ? (
            // The primary surface pairs the live map with the air-quality panel.
            <>
              <MapSurface />
              <AirQualityPanel />
            </>
          ) : activeSurface === 'evacuation' ? (
            <EvacuationPage />
          ) : (
            <ReliefPage />
          )}
        </div>
      </main>
    </div>
  )
}

export default App
