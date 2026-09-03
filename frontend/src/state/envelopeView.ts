/**
 * Pure per-source state mapping (spec §Behavior & states): one FeedResult
 * envelope becomes exactly one render state. No DOM, no React — trivially
 * testable, and the UI components stay presentational.
 */

import type { FeedResult } from '../api/types'
import { feedAge } from '../map/legend'

export type EnvelopeViewKind = 'ready' | 'stale' | 'failed' | 'empty'

export interface EnvelopeView {
  kind: EnvelopeViewKind
  /** i18n key + count for the data age ("updated X ago"); null when no time applies. */
  age: { key: string; count?: number } | null
}

/**
 * The state matrix for one loaded envelope:
 * - failed            → plain error + official fallback link (never blank)
 * - ok/empty data     → the dated "no active incidents" state
 * - stale             → last-good data + "updated Xh ago" badge
 * - ok with data      → live data + "updated X ago" stamp
 */
export function envelopeView<T>(result: FeedResult<T>, nowMs: number): EnvelopeView {
  if (result.status === 'failed') return { kind: 'failed', age: null }
  if ((result.data?.length ?? 0) === 0) return { kind: 'empty', age: null }
  return {
    kind: result.status === 'stale' ? 'stale' : 'ready',
    age: feedAge(result.meta.fetchedAt, nowMs),
  }
}
