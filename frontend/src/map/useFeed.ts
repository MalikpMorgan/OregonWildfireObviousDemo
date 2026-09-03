/**
 * Single-feed loader: resolves to the FeedResult envelope, or synthesizes a failed
 * envelope on network/HTTP errors so the UI renders one degradation path.
 */

import { useEffect, useRef, useState } from 'react'
import type { FeedFetcher } from '../api/client'
import type { FeedResult, SourceMeta } from '../api/types'
import { useOnlineStatus } from '../state/offline'

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
  const [attempt, setAttempt] = useState(0)
  const online = useOnlineStatus()
  const armedOnMount = useRef(false)

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
  }, [fetcher, fallbackMeta, attempt])

  // Connectivity returning re-runs the fetch — the offline state's exit
  // (spec §Behavior & states: "Exits when: connectivity returns").
  useEffect(() => {
    if (!armedOnMount.current) {
      armedOnMount.current = true
      return
    }
    if (online) setAttempt((current) => current + 1)
  }, [online])

  return state
}
