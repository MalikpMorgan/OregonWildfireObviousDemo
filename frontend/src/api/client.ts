/**
 * Typed fetchers for the FastAPI feed routes. Every route serves the FeedResult
 * envelope (ok / stale / failed) — a failed feed resolves, it never throws for
 * "expected" degradation; network/HTTP errors still reject and render as the
 * failed state at the call site.
 */

import type { FeedResult, FireAlert, FireIncident, FirePerimeter } from './types'

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
