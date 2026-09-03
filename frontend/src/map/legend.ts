/**
 * Pure legend assembly: turns feed states into legend rows. No DOM, no React —
 * trivially testable; the Legend component stays presentational.
 */

import type { FeedStatus } from '../api/types'
import { ageParts } from './format'

export type LegendStatusKind = 'loading' | 'live' | 'stale' | 'failed'

export interface LegendLayer {
  id: string
  name: string
  swatch: string
  sourceLabel: string
  sourceUrl: string
  statusKind: LegendStatusKind
  statusLabel: string
  /** Pre-translated "updated X ago" line, or null while nothing is fetched. */
  ageLabel: string | null
  note: string | null
}

export interface LegendStatusLabels {
  loading: string
  live: string
  stale: string
  failed: string
}

/** i18n key + count for a feed's data age; a missing count means "just now". */
export function feedAge(fetchedAt: number, nowMs: number): { key: string; count?: number } {
  const parts = ageParts(fetchedAt, nowMs)
  if (!parts) return { key: 'map.ageJustNow' }
  if (parts.unit === 'min') return { key: 'map.ageMinutes', count: parts.value }
  if (parts.unit === 'hour') return { key: 'map.ageHours', count: parts.value }
  return { key: 'map.ageDays', count: parts.value }
}

export interface LegendFeedInput {
  id: string
  name: string
  swatch: string
  sourceLabel: string
  sourceUrl: string
  status: FeedStatus
  statusLabels: LegendStatusLabels
  /** Pre-translated data-age line; null for failed/loading feeds. */
  ageLabel: string | null
  note?: string | null
}

const STATUS_KIND: Record<FeedStatus, LegendStatusKind> = {
  ok: 'live',
  stale: 'stale',
  failed: 'failed',
}

/** One legend row from a feed envelope's status and freshness metadata. */
export function feedLegendLayer(feed: LegendFeedInput): LegendLayer {
  const statusKind = STATUS_KIND[feed.status]
  return {
    id: feed.id,
    name: feed.name,
    swatch: feed.swatch,
    sourceLabel: feed.sourceLabel,
    sourceUrl: feed.sourceUrl,
    statusKind,
    statusLabel: feed.statusLabels[statusKind],
    ageLabel: feed.ageLabel,
    note: feed.note ?? null,
  }
}
