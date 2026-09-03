/**
 * Air-quality panel behavior against the fixture envelopes: the eight reference
 * cities (six urban, two rural) render with number + text category + "model
 * estimate" label and official links; geolocation states (granted, denied,
 * unavailable, unsupported) all degrade cleanly; the failed-AQI envelope shows
 * the error note while the official monitor links stay available.
 */

import { render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeAqiCitiesEnvelope, makeAqiPointEnvelope } from '../api/fixtures'
import i18n from '../i18n'
import AirQualityPanel from './AirQualityPanel'

const now = Date.now()

vi.mock('../api/client', () => ({
  getAqiReference: vi.fn(),
  getAqiAt: vi.fn(),
}))

import { getAqiAt, getAqiReference } from '../api/client'
const mockedGetAqiReference = vi.mocked(getAqiReference)
const mockedGetAqiAt = vi.mocked(getAqiAt)

type GeoBehavior = 'granted' | 'denied' | 'error'

/** Install a navigator.geolocation stub with the requested behavior. */
function installGeolocation(behavior: GeoBehavior): void {
  const getCurrentPosition = (
    success: PositionCallback,
    error?: PositionErrorCallback,
  ): void => {
    if (behavior === 'granted') {
      success({
        coords: { latitude: 44.0, longitude: -121.3 },
        timestamp: now,
      } as GeolocationPosition)
    } else {
      error?.({
        code: behavior === 'denied' ? 1 : 2,
        message: behavior === 'denied' ? 'permission denied' : 'position unavailable',
      } as GeolocationPositionError)
    }
  }
  Object.defineProperty(navigator, 'geolocation', {
    value: { getCurrentPosition },
    configurable: true,
  })
}

afterEach(() => {
  // Remove the stub so later suites see jsdom's default (no geolocation).
  Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true })
  // Language is global state on the shared i18n instance — reset between tests.
  void i18n.changeLanguage('en')
})

describe('AirQualityPanel', () => {
  it('renders all eight reference cities including rural Oregon', async () => {
    mockedGetAqiReference.mockResolvedValue(makeAqiCitiesEnvelope(now))
    render(<AirQualityPanel />)
    expect(await screen.findByText('Portland')).toBeInTheDocument()
    for (const city of ['Salem', 'Eugene', 'Bend', 'Medford', 'Pendleton', 'Klamath Falls', 'La Grande']) {
      expect(screen.getByText(city)).toBeInTheDocument()
    }
  })

  it('labels every reading with the number, text category, and model-estimate notice', async () => {
    mockedGetAqiReference.mockResolvedValue(makeAqiCitiesEnvelope(now))
    render(<AirQualityPanel />)
    expect(await screen.findByText('Portland')).toBeInTheDocument()
    // Eight cards, each with its US AQI number, text category, and estimate label.
    expect(screen.getAllByText('US AQI')).toHaveLength(8)
    expect(screen.getAllByText('Moderate')).toHaveLength(4)
    expect(screen.getAllByText('Good')).toHaveLength(4)
    expect(screen.getAllByText('Model estimate')).toHaveLength(8)
  })

  it('shows attribution with the feed age and the official monitor links', async () => {
    mockedGetAqiReference.mockResolvedValue(makeAqiCitiesEnvelope(now))
    render(<AirQualityPanel />)
    expect(await screen.findByText(/Source: Open-Meteo, updated/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'aqi.oregon.gov' })).toHaveAttribute(
      'href',
      'https://aqi.oregon.gov/',
    )
    expect(screen.getByRole('link', { name: 'oregonsmoke.org' })).toHaveAttribute(
      'href',
      'https://oregonsmoke.org/',
    )
  })

  it('shows the reader-location estimate when geolocation is granted', async () => {
    installGeolocation('granted')
    mockedGetAqiReference.mockResolvedValue(makeAqiCitiesEnvelope(now))
    mockedGetAqiAt.mockReturnValue(() => Promise.resolve(makeAqiPointEnvelope(now)))
    render(<AirQualityPanel />)
    expect(await screen.findByText('Your location')).toBeInTheDocument()
    const card = screen.getByText('Your location').closest('li')
    expect(card).not.toBeNull()
    if (card) {
      expect(card).toHaveTextContent('45')
      expect(card).toHaveTextContent('Good')
      expect(card).toHaveTextContent('Model estimate')
    }
  })

  it('degrades to reference cities when geolocation is denied', async () => {
    installGeolocation('denied')
    mockedGetAqiReference.mockResolvedValue(makeAqiCitiesEnvelope(now))
    render(<AirQualityPanel />)
    expect(await screen.findByText(/Location sharing is off/)).toBeInTheDocument()
    // Degradation contract: the reference cities still render.
    expect(screen.getByText('Pendleton')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Use my location' })).toBeInTheDocument()
  })

  it('degrades to reference cities when the position cannot be fixed', async () => {
    installGeolocation('error')
    mockedGetAqiReference.mockResolvedValue(makeAqiCitiesEnvelope(now))
    render(<AirQualityPanel />)
    expect(await screen.findByText(/Your location couldn't be detected/)).toBeInTheDocument()
    expect(screen.getByText('La Grande')).toBeInTheDocument()
  })

  it('degrades to reference cities when geolocation is unsupported', async () => {
    // jsdom ships no navigator.geolocation — the default state here.
    mockedGetAqiReference.mockResolvedValue(makeAqiCitiesEnvelope(now))
    render(<AirQualityPanel />)
    expect(await screen.findByText(/This browser can't detect location/)).toBeInTheDocument()
    expect(screen.getByText('Bend')).toBeInTheDocument()
  })

  it('shows the failed-AQI envelope note and keeps the official links', async () => {
    mockedGetAqiReference.mockResolvedValue(makeAqiCitiesEnvelope(now, 'failed'))
    render(<AirQualityPanel />)
    expect(
      await screen.findByText('The air quality feed is unavailable right now.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'aqi.oregon.gov' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'oregonsmoke.org' })).toBeInTheDocument()
  })

  it('notes the point-reading failure when the location request rejects', async () => {
    installGeolocation('granted')
    mockedGetAqiReference.mockResolvedValue(makeAqiCitiesEnvelope(now))
    mockedGetAqiAt.mockReturnValue(() => Promise.reject(new Error('network down')))
    render(<AirQualityPanel />)
    expect(
      await screen.findByText("Your location's reading is unavailable right now."),
    ).toBeInTheDocument()
    // The reference cities survive the point failure.
    expect(screen.getByText('Portland')).toBeInTheDocument()
  })

  it('has no detectable axe accessibility violations', async () => {
    installGeolocation('granted')
    mockedGetAqiReference.mockResolvedValue(makeAqiCitiesEnvelope(now))
    mockedGetAqiAt.mockReturnValue(() => Promise.resolve(makeAqiPointEnvelope(now)))
    const { container } = render(<AirQualityPanel />)
    await screen.findByText('Your location')
    expect((await axe(container)).violations).toEqual([])
  })
})
