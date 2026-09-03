/**
 * Detail-panel behavior against the fixture envelopes: every feed fact renders,
 * an all-null incident shows "Not reported" for each optional field, the InciWeb
 * narrative appears when the envelope carries one, and missing/failed narratives
 * degrade to the official incident-page link without ever blanking the panel.
 */

import { render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  allNullIncident,
  makeEmptyNarrativeEnvelope,
  makeFailedNarrativeEnvelope,
  makeNarrativeEnvelope,
  recordedIncidents,
} from '../api/fixtures'
import i18n from '../i18n'
import IncidentDetail from './IncidentDetail'

const now = Date.now()

vi.mock('../api/client', () => ({
  getNarrative: vi.fn(),
}))

import { getNarrative } from '../api/client'
const mockedGetNarrative = vi.mocked(getNarrative)

afterEach(() => {
  // Language is global state on the shared i18n instance — reset between tests.
  void i18n.changeLanguage('en')
})

describe('IncidentDetail', () => {
  it('renders every feed fact of a fully-populated incident', async () => {
    mockedGetNarrative.mockResolvedValue(makeEmptyNarrativeEnvelope(now))
    render(<IncidentDetail incident={recordedIncidents[0]} />)
    expect(screen.getByText('North Cayuse')).toBeInTheDocument()
    expect(screen.getByText('Umatilla')).toBeInTheDocument()
    expect(screen.getByText('4,887')).toBeInTheDocument()
    expect(screen.getByText('97% contained')).toBeInTheDocument()
    expect(screen.getByText('Human')).toBeInTheDocument()
  })

  it('renders "Not reported" for every optional field of an all-null incident', async () => {
    mockedGetNarrative.mockResolvedValue(makeEmptyNarrativeEnvelope(now))
    render(<IncidentDetail incident={allNullIncident} />)
    // County, acres, containment, cause, and the feed's own update time — the
    // name is always present, so the panel is never blank.
    expect(screen.getByText('Cedar Creek')).toBeInTheDocument()
    expect(screen.getAllByText('Not reported')).toHaveLength(5)
  })

  it('shows the InciWeb narrative when the envelope carries one', async () => {
    mockedGetNarrative.mockResolvedValue(makeNarrativeEnvelope(now))
    render(<IncidentDetail incident={recordedIncidents[0]} />)
    expect(await screen.findByRole('heading', { name: 'About this fire' })).toBeInTheDocument()
    expect(screen.getByText(/Umatilla National Forest/)).toBeInTheDocument()
    expect(screen.getByText(/Narrative last updated 2026-09-03/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Read more on InciWeb' })).toHaveAttribute(
      'href',
      'https://inciweb.wildfire.gov/incident-information/or973s-north-cayuse',
    )
  })

  it('links the official incident page when the incident has no narrative', async () => {
    mockedGetNarrative.mockResolvedValue(makeEmptyNarrativeEnvelope(now))
    render(<IncidentDetail incident={recordedIncidents[0]} />)
    expect(
      await screen.findByText('This incident has no official narrative on InciWeb yet.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open the official incident page on InciWeb' })).toHaveAttribute(
      'href',
      'https://inciweb.wildfire.gov/',
    )
  })

  it('links the official incident page and keeps the facts when the narrative feed fails', async () => {
    mockedGetNarrative.mockResolvedValue(makeFailedNarrativeEnvelope(now))
    render(<IncidentDetail incident={recordedIncidents[0]} />)
    expect(
      await screen.findByText('The incident narrative feed is unavailable right now.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open the official incident page on InciWeb' })).toBeInTheDocument()
    // Degradation contract: the feed facts stay visible — no blank panel.
    expect(screen.getByText('North Cayuse')).toBeInTheDocument()
    expect(screen.getByText('Umatilla')).toBeInTheDocument()
  })

  it('degrades to the official link when the narrative request rejects', async () => {
    mockedGetNarrative.mockRejectedValue(new Error('network down'))
    render(<IncidentDetail incident={recordedIncidents[0]} />)
    expect(
      await screen.findByText('The incident narrative feed is unavailable right now.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open the official incident page on InciWeb' })).toBeInTheDocument()
  })

  it('shows the loading state before the narrative resolves', async () => {
    mockedGetNarrative.mockReturnValue(new Promise(() => {}))
    render(<IncidentDetail incident={recordedIncidents[0]} />)
    expect(screen.getByText('Looking up the official incident narrative…')).toBeInTheDocument()
  })

  it('has no detectable axe accessibility violations', async () => {
    mockedGetNarrative.mockResolvedValue(makeNarrativeEnvelope(now))
    const { container } = render(<IncidentDetail incident={recordedIncidents[0]} />)
    await screen.findByRole('heading', { name: 'About this fire' })
    expect((await axe(container)).violations).toEqual([])
  })
})
