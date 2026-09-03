/**
 * Offline browser-cache mock tests (spec §Behavior & states, "Offline" row):
 * the shell says what still works, keeps 2-1-1 one tap away, and feeds
 * refetch when connectivity returns. navigator.onLine and the browser's
 * online/offline events are stubbed — no real network.
 */

import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeFiresEnvelope } from '../api/fixtures'
// Importing the i18n module initializes the shared instance before render.
import '../i18n'
import OfflineBanner from './OfflineBanner'
import { useFeed } from '../map/useFeed'
import { WFIGS_SOURCE_URL } from '../api/sources'
import type { FireIncident } from '../api/types'
import type { FeedFetcher } from '../api/client'

const wfigsFallback = {
  source: 'wfigs' as const,
  sourceUrl: WFIGS_SOURCE_URL,
  fetchedAt: 1_800_000_000_000,
}

function setOnLine(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value,
  })
}

/** Probe component: renders the hook state and a marked feed state. */
function FeedProbe({ fetcher }: { fetcher: FeedFetcher<FireIncident> }) {
  const state = useFeed(fetcher, wfigsFallback)
  return (
    <div data-testid="feed-probe">
      {state.kind === 'loading'
        ? 'loading'
        : `${state.result.status}:${state.result.data?.length ?? 0}`}
    </div>
  )
}

describe('useOnlineStatus / OfflineBanner', () => {
  beforeEach(() => {
    setOnLine(true)
  })

  afterEach(() => {
    setOnLine(true)
    vi.restoreAllMocks()
  })

  it('shows the banner with the 2-1-1 link when the browser reports offline', () => {
    setOnLine(false)
    render(<OfflineBanner />)
    expect(screen.getByTestId('offline-banner')).toHaveAttribute('role', 'alert')
    expect(screen.getByTestId('offline-banner')).toHaveTextContent(/You're offline/)
    expect(screen.getByRole('link', { name: 'Call 211' })).toHaveAttribute('href', 'tel:211')
    expect(screen.getByText(/evacuation guidance and relief directory/)).toBeInTheDocument()
  })

  it('renders nothing while online', () => {
    setOnLine(true)
    const { container } = render(<OfflineBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('leaves the offline state when the browser fires the online event', async () => {
    setOnLine(false)
    const { container } = render(<OfflineBanner />)
    expect(screen.getByTestId('offline-banner')).toBeInTheDocument()

    setOnLine(true)
    await act(async () => {
      window.dispatchEvent(new Event('online'))
    })
    expect(container).toBeEmptyDOMElement()
  })

  it('feeds refetch when connectivity returns (browser-cache recovery)', async () => {
    // Mount while offline: the fetch rejects — the cached shell renders, feeds fail.
    setOnLine(false)
    const fetcher = vi.fn()
    fetcher.mockRejectedValueOnce(new Error('network down'))
    fetcher.mockResolvedValue(makeFiresEnvelope(1_800_000_000_000))

    const { getByTestId } = render(
      <FeedProbe fetcher={fetcher as unknown as FeedFetcher<FireIncident>} />,
    )
    await waitFor(() => {
      expect(getByTestId('feed-probe')).toHaveTextContent(/^failed:0$/)
    })
    expect(fetcher).toHaveBeenCalledTimes(1)

    // Connectivity returns → the hook re-runs the fetch and recovers to live data.
    setOnLine(true)
    window.dispatchEvent(new Event('online'))
    await waitFor(() => {
      expect(getByTestId('feed-probe')).toHaveTextContent(/^ok:4$/)
    })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
