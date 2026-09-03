/**
 * Kill-switch UI matrix (spec §Behavior & states): drive every envelope status
 * per source against the recorded fixtures and assert each surface renders its
 * own state — named skeletons while loading, live data with "updated X ago"
 * stamps, stale badge over last-good data, plain-language failure with the
 * official fallback link, dated empty state — and that a failed source never
 * blanks its panel or takes down the others.
 */

import { render, screen } from '@testing-library/react'
import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  makeEnvelope,
  makeEmptyNarrativeEnvelope,
  makeFiresEnvelope,
  makePerimetersEnvelope,
  recordedAlerts,
  recordedIncidents,
} from '../api/fixtures'
import { NWS_SOURCE_URL, WFIGS_SOURCE_URL } from '../api/sources'
import type { FeedResult, FireAlert, FirePerimeter } from '../api/types'
import i18n from '../i18n'
import MapSurface from '../map/MapSurface'
import { MockMap } from '../test/maplibre-mock'

vi.mock('maplibre-gl', async () => await import('../test/maplibre-mock'))

// Controllable per-feed mocks: each test resolves exactly the envelopes the
// scenario needs, everything else resolves to the recorded ready state.
const clientMocks = vi.hoisted(() => ({
  getFires: vi.fn(),
  getPerimeters: vi.fn(),
  getAlerts: vi.fn(),
  getNarrative: vi.fn(),
}))

vi.mock('../api/client', () => clientMocks)

const NOW = Date.now()
const wfigsMeta = { source: 'wfigs' as const, sourceUrl: WFIGS_SOURCE_URL, fetchedAt: NOW }
const nwsMeta = { source: 'nws' as const, sourceUrl: NWS_SOURCE_URL, fetchedAt: NOW }

function resolveAllFeeds(
  fires: FeedResult<(typeof recordedIncidents)[number]> = makeFiresEnvelope(NOW),
  perimeters: FeedResult<FirePerimeter> = makePerimetersEnvelope(NOW),
  alerts: FeedResult<FireAlert> = makeEnvelope('ok', recordedAlerts, nwsMeta),
) {
  clientMocks.getFires.mockResolvedValue(fires)
  clientMocks.getPerimeters.mockResolvedValue(perimeters)
  clientMocks.getAlerts.mockResolvedValue(alerts)
  clientMocks.getNarrative.mockResolvedValue(makeEmptyNarrativeEnvelope(NOW))
}

beforeEach(() => {
  MockMap.instances.length = 0
  resolveAllFeeds()
})

afterEach(() => {
  // Language is global state on the shared i18n instance — reset between tests.
  void i18n.changeLanguage('en')
})

describe('feed state matrix (MapSurface)', () => {
  it('renders a named skeleton per source while loading — never a fake empty', async () => {
    clientMocks.getFires.mockReturnValue(new Promise(() => undefined))
    clientMocks.getPerimeters.mockReturnValue(new Promise(() => undefined))
    clientMocks.getAlerts.mockReturnValue(new Promise(() => undefined))

    render(<MapSurface />)

    expect(await screen.findByText('Loading incident points from NIFC WFIGS…')).toBeInTheDocument()
    expect(screen.getByText('Loading perimeter polygons from NIFC WFIGS…')).toBeInTheDocument()
    expect(screen.getByText('Loading fire weather alerts from NWS…')).toBeInTheDocument()
    // Honesty while loading: no empty-state claim, no stale claim, no list.
    expect(screen.queryByText(/No active incidents reported/)).not.toBeInTheDocument()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.queryByText('Data updated just now')).not.toBeInTheDocument()
  })

  it('shows live data with the "updated X ago" stamp in the ready state', async () => {
    render(<MapSurface />)
    expect(await screen.findByRole('listbox', { name: 'Active incidents' })).toBeInTheDocument()
    // Fresh data: stamp, not stale badge.
    expect(screen.getByText('Data updated just now')).toBeInTheDocument()
    expect(
      screen.queryByText('Showing the last good data saved for this feed.'),
    ).not.toBeInTheDocument()
  })

  it('keeps the list and shows the stale badge when a source serves last-good data', async () => {
    resolveAllFeeds(
      makeEnvelope('stale', recordedIncidents, {
        ...wfigsMeta,
        fetchedAt: NOW - 3 * 60 * 60_000,
      }),
    )
    render(<MapSurface />)
    // Kill-switch contract: last-good incidents stay visible under the badge.
    expect(await screen.findByRole('listbox', { name: 'Active incidents' })).toBeInTheDocument()
    expect(screen.getByText(recordedIncidents[0].name)).toBeInTheDocument()
    const stale = screen.getByTestId('feed-stale')
    expect(stale).toHaveTextContent('updated 3 h ago')
    expect(stale).toHaveTextContent('Showing the last good data saved for this feed.')
  })

  it('a failed incident feed degrades to the error + fallback link without touching alerts', async () => {
    resolveAllFeeds(makeEnvelope('failed', null, wfigsMeta, 'WFIGS unavailable'))
    render(<MapSurface />)

    expect(
      await screen.findByText('The federal incident feed is unavailable right now.'),
    ).toBeInTheDocument()
    // Official fallback link for the failed source.
    expect(screen.getByRole('link', { name: 'Open the NIFC open data site' })).toHaveAttribute(
      'href',
      WFIGS_SOURCE_URL,
    )
    // The failed feed blanks its own list — and nothing else.
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(
      screen.queryByText('The weather alert feed is unavailable right now.'),
    ).not.toBeInTheDocument()
  })

  it('a failed alert feed shows its error + NWS link while incidents keep rendering', async () => {
    resolveAllFeeds(
      makeFiresEnvelope(NOW),
      makePerimetersEnvelope(NOW),
      makeEnvelope('failed', null, nwsMeta, 'NWS unavailable'),
    )
    render(<MapSurface />)

    expect(
      await screen.findByText('The weather alert feed is unavailable right now.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open NWS active alerts' })).toHaveAttribute(
      'href',
      NWS_SOURCE_URL,
    )
    // The incident surface is independent of the alert failure.
    expect(await screen.findByRole('listbox', { name: 'Active incidents' })).toBeInTheDocument()
    expect(screen.getByText(`${recordedIncidents.length} active incidents`)).toBeInTheDocument()
  })

  it('an empty incident feed shows the dated no-incidents state with official links', async () => {
    resolveAllFeeds(makeEnvelope('ok', [], wfigsMeta))
    render(<MapSurface />)

    const empty = await screen.findByTestId('incidents-empty')
    expect(empty).toHaveTextContent(/No active incidents reported as of /)
    expect(screen.getByRole('link', { name: 'Open the NIFC open data site' })).toHaveAttribute(
      'href',
      WFIGS_SOURCE_URL,
    )
    expect(screen.getByRole('link', { name: 'Open NWS active alerts' })).toHaveAttribute(
      'href',
      NWS_SOURCE_URL,
    )
    // Honest empty ≠ failed: no error text, no stale badge.
    expect(
      screen.queryByText('The federal incident feed is unavailable right now.'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('Showing the last good data saved for this feed.'),
    ).not.toBeInTheDocument()
  })

  it('recovers every source when connectivity returns after a full outage', async () => {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false })
    clientMocks.getFires.mockRejectedValue(new Error('network down'))
    clientMocks.getPerimeters.mockRejectedValue(new Error('network down'))
    clientMocks.getAlerts.mockRejectedValue(new Error('network down'))

    const view = render(<MapSurface />)

    // Offline: per-source failed notices — the shell never blanks.
    expect(
      await screen.findByText('The federal incident feed is unavailable right now.'),
    ).toBeInTheDocument()
    expect(screen.getByText('The weather alert feed is unavailable right now.')).toBeInTheDocument()

    // Connectivity returns → every feed refetches and recovers to live data.
    clientMocks.getFires.mockResolvedValue(makeFiresEnvelope(NOW))
    clientMocks.getPerimeters.mockResolvedValue(makePerimetersEnvelope(NOW))
    clientMocks.getAlerts.mockResolvedValue(makeEnvelope('ok', recordedAlerts, nwsMeta))
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true })
    await act(async () => {
      window.dispatchEvent(new Event('online'))
    })

    expect(await screen.findByRole('listbox', { name: 'Active incidents' })).toBeInTheDocument()
    expect(screen.getByText('Data updated just now')).toBeInTheDocument()
    view.unmount()
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true })
  })
})
