/**
 * Offline shell (spec §Behavior & states, "Offline" row): when the device is
 * offline the static shell, curated guidance, and the 2-1-1 phone line remain
 * usable — the banner says so instead of leaving silent failures. Renders
 * nothing while online.
 */

import { useTranslation } from 'react-i18next'
import { reliefResources } from '../content/relief'
import { useOnlineStatus } from './offline'

// The 211 info line — single source of truth is the curated relief content.
const INFO_LINE = reliefResources.find((entry) => entry.id === '211info')

export default function OfflineBanner() {
  const online = useOnlineStatus()
  const { t } = useTranslation()

  if (online) return null
  const phone = INFO_LINE?.phone ?? '211'

  return (
    <div className="offline-banner" role="alert" data-testid="offline-banner">
      <p className="offline-banner__title">{t('app.offlineTitle')}</p>
      <p>{t('app.offlineBody')}</p>
      <p className="offline-banner__call">
        <a href={`tel:${phone}`}>{t('relief.phoneLabel', { phone })}</a>
      </p>
    </div>
  )
}
