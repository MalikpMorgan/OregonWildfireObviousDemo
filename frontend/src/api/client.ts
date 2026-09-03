/**
 * Typed fetchers for the FastAPI feed routes. Every route serves the FeedResult
 * envelope (ok / stale / failed) — a failed feed resolves, it never throws for
 * "expected" degradation; network/HTTP errors still reject and render as the
 * failed state at the call site.
 */

import type {
  AirReading,
  FeedResult,
  FireAlert,
  FireIncident,
  FirePerimeter,
  IncidentNarrative,
} from './types'

const API_BASE: string = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export type FeedFetcher<T> = () => Promise<FeedResult<T>>

async function fetchEnvelope<T>(path: string): Promise<FeedResult<T>> {
  const response = await fetch(`${API_BASE}${path}`)
  if (!response.ok) {
    throw new Error(`${path} responded with HTTP ${response.status}`)
  }
  return (await response.json()) as FeedResult<T>
}

export const getFires: FeedFetcher<FireIncident> = () => fetchEnvelope('/api/fires')

export const getPerimeters: FeedFetcher<FirePerimeter> = () => fetchEnvelope('/api/perimeters')

export const getAlerts: FeedFetcher<FireAlert> = () => fetchEnvelope('/api/alerts')

/** InciWeb narrative for one incident; an empty data list means no InciWeb record. */
export function getNarrative(incidentId: string): Promise<FeedResult<IncidentNarrative>> {
  return fetchEnvelope(`/api/incidents/${encodeURIComponent(incidentId)}/narrative`)
}

/** US AQI for the reference cities (and the point when lat/lon are given). */
export const getAqiReference: FeedFetcher<AirReading> = () => fetchEnvelope('/api/aqi')

export function getAqiAt(lat: number, lon: number): FeedFetcher<AirReading> {
  return () => fetchEnvelope(`/api/aqi?lat=${lat}&lon=${lon}`)
}
