/**
 * Single-feed loader: resolves to the FeedResult envelope, or synthesizes a failed
 * envelope on network/HTTP errors so the UI renders one degradation path.
 */

import { useEffect, useState } from 'react'
import type { FeedFetcher } from '../api/client'
import type { FeedResult, SourceMeta } from '../api/types'

export type FeedState<T> = { kind: 'loading' } | { kind: 'loaded'; result: FeedResult<T> }

export function failedEnvelope<T>(meta: SourceMeta, error: unknown): FeedResult<T> {
  return {
    status: 'failed',
    data: null,
    meta,
    error: error instanceof Error ? error.message : String(error),
  }
}

export function useFeed<T>(fetcher: FeedFetcher<T>, fallbackMeta: SourceMeta): FeedState<T> {
  const [state, setState] = useState<FeedState<T>>({ kind: 'loading' })
  useEffect(() => {
    let cancelled = false
    fetcher()
      .then((result) => {
        if (!cancelled) setState({ kind: 'loaded', result })
      })
      .catch((error: unknown) => {
        // Never swallow — the envelope carries the failure to the UI.
        if (!cancelled) setState({ kind: 'loaded', result: failedEnvelope(fallbackMeta, error) })
      })
    return () => {
      cancelled = true
    }
  }, [fetcher, fallbackMeta])
  return state
}
