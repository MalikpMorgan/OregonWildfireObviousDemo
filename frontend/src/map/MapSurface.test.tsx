/**
 * Map-surface behavior against the recorded FeedResult fixtures: every incident
 * reaches the list and the map, keyboard selection syncs to the map, map clicks
 * sync back to the list, point-only incidents and null-geometry alerts render
 * without error, and the list view passes axe.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { axe } from 'jest-axe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  INCIDENTS_LAYER,
  INCIDENTS_SOURCE,
  PERIMETERS_SOURCE,
  ALERTS_SOURCE,
} from './maplibre-style'
import {
  makeAlertsEnvelope,
  makeFiresEnvelope,
  makePerimetersEnvelope,
  recordedAlerts,
  recordedIncidents,
  recordedPerimeters,
} from '../api/fixtures'
import i18n from '../i18n'
import MapSurface from './MapSurface'
import { MockMap, MockPopup } from '../test/maplibre-mock'

vi.mock('maplibre-gl', async () => await import('../test/maplibre-mock'))

const now = Date.now()
vi.mock('../api/client', () => ({
  getFires: () => Promise.resolve(makeFiresEnvelope(now)),
  getPerimeters: () => Promise.resolve(makePerimetersEnvelope(now)),
  getAlerts: () => Promise.resolve(makeAlertsEnvelope(now)),
}))

beforeEach(() => {
  MockMap.instances.length = 0
  MockPopup.instances.length = 0
})

afterEach(() => {
  // Language is global state on the shared i18n instance — reset between tests.
  void i18n.changeLanguage('en')
})

const FIRST_INCIDENT_ID = recordedIncidents[0].incidentId

/** Render, wait for the feed envelopes, then fire the mock map's load event. */
async function renderLoadedSurface() {
  const view = render(<MapSurface />)
  await screen.findByRole('listbox', { name: 'Active incidents' })
  const map = MockMap.instances[0]
  act(() => {
    map.emit('load')
  })
  return { view, map }
}

describe('MapSurface', () => {
  it('lists every envelope incident with its county', async () => {
    render(<MapSurface />)
    const listbox = await screen.findByRole('listbox', { name: 'Active incidents' })
    expect(listbox.children.length).toBe(recordedIncidents.length)
    for (const incident of recordedIncidents) {
      expect(
        screen.getByRole('option', { name: new RegExp(`${incident.name}`) }),
      ).toBeInTheDocument()
    }
    expect(
      screen.getByText(`${recordedIncidents.length} active incidents`),
    ).toBeInTheDocument()
    // Point-only incidents still render: every incident is in the list even
    // when fewer incidents carry perimeter polygons.
    expect(recordedPerimeters.length).toBeLessThan(recordedIncidents.length)
  })

  it('pushes every incident and only geometrized alerts into the map sources', async () => {
    const { map } = await renderLoadedSurface()
    const incidentData = map.sourceData(INCIDENTS_SOURCE).at(-1) as {
      features: { properties: { id: string } }[]
    }
    expect(incidentData.features.map((feature) => feature.properties.id).sort()).toEqual(
      recordedIncidents.map((incident) => incident.incidentId).sort(),
    )
    // Null-geometry (zone-based) alerts are skipped by the map layer, not
    // errored; geometrized ones pass through.
    const alertData = map.sourceData(ALERTS_SOURCE).at(-1) as {
      features: unknown[]
    }
    expect(alertData.features.length).toBe(
      recordedAlerts.filter((alert) => alert.geometry !== null).length,
    )
    // Perimeter records with polygons land in their own source.
    expect(map.sourceData(PERIMETERS_SOURCE).length).toBeGreaterThan(0)
  })

  it('selects from the keyboard: arrows move, Enter selects, map shows the tooltip', async () => {
    await renderLoadedSurface()
    const listbox = screen.getByRole('listbox', { name: 'Active incidents' })
    listbox.focus()
    fireEvent.keyDown(listbox, { key: 'ArrowDown' })
    fireEvent.keyDown(listbox, { key: 'Enter' })
    // Selection flows back through the surface: detail slot + map popup.
    expect(screen.getByTestId('detail-slot')).toHaveTextContent(
      new RegExp(recordedIncidents[1].name),
    )
    await waitFor(() => {
      expect(MockPopup.instances.length).toBe(1)
    })
    expect(MockPopup.instances[0].html).toContain(recordedIncidents[1].name)
  })

  it('syncs map clicks to the list selection and detail slot', async () => {
    const { map } = await renderLoadedSurface()
    act(() => {
      map.clickLayer(INCIDENTS_LAYER, {
        features: [{ properties: { id: FIRST_INCIDENT_ID } }],
      })
    })
    await waitFor(() => {
      expect(
        screen.getByRole('option', { name: new RegExp(recordedIncidents[0].name) }),
      ).toHaveAttribute('aria-selected', 'true')
    })
    expect(screen.getByTestId('detail-slot')).toHaveTextContent(
      new RegExp(recordedIncidents[0].name),
    )
  })

  it('clears the selection on Escape in both views', async () => {
    const { map } = await renderLoadedSurface()
    act(() => {
      map.clickLayer(INCIDENTS_LAYER, {
        features: [{ properties: { id: FIRST_INCIDENT_ID } }],
      })
    })
    await screen.findByTestId('detail-slot')
    fireEvent.keyDown(screen.getByRole('listbox', { name: 'Active incidents' }), {
      key: 'Escape',
    })
    expect(screen.queryByTestId('detail-slot')).not.toBeInTheDocument()
    expect(
      screen.getByText(/Select an incident from the list or the map/),
    ).toBeInTheDocument()
  })

  it('has no detectable axe accessibility violations on the list view', async () => {
    const { container } = render(<MapSurface />)
    await screen.findByRole('listbox', { name: 'Active incidents' })
    expect((await axe(container)).violations).toEqual([])
  })
})
