/**
 * The pure per-source state mapping (spec §Behavior & states): one envelope in,
 * exactly one render state out — ready, stale, failed, or empty — with the
 * data-age metadata the stamps and badges render.
 */

import { describe, expect, it } from 'vitest'
import { makeEnvelope, recordedIncidents } from '../api/fixtures'
import { OPENMETEO_SOURCE_URL, WFIGS_SOURCE_URL } from '../api/sources'
import { envelopeView } from './envelopeView'

const NOW = 1_800_000_000_000
const WFIGS_META = {
  source: 'wfigs' as const,
  sourceUrl: WFIGS_SOURCE_URL,
  fetchedAt: NOW,
}

describe('envelopeView', () => {
  it('maps a failed envelope to the failed state with no age', () => {
    const view = envelopeView(makeEnvelope('failed', null, WFIGS_META, 'boom'), NOW)
    expect(view).toEqual({ kind: 'failed', age: null })
  })

  it('maps ok-empty data to the dated empty state', () => {
    const view = envelopeView(makeEnvelope('ok', [], WFIGS_META), NOW)
    expect(view).toEqual({ kind: 'empty', age: null })
  })

  it('maps a stale envelope with rows to the stale state plus age', () => {
    const meta = { ...WFIGS_META, fetchedAt: NOW - 3 * 60 * 60_000 }
    const view = envelopeView(makeEnvelope('stale', recordedIncidents, meta), NOW)
    expect(view.kind).toBe('stale')
    expect(view.age?.key).toBe('map.ageHours')
    expect(view.age?.count).toBe(3)
  })

  it('maps fresh ok data to the ready state plus age', () => {
    const view = envelopeView(makeEnvelope('ok', recordedIncidents, WFIGS_META), NOW)
    expect(view.kind).toBe('ready')
    expect(view.age?.key).toBe('map.ageJustNow')
  })

  it('treats null data on an ok envelope as empty, never ready', () => {
    const view = envelopeView(makeEnvelope('ok', null, WFIGS_META), NOW)
    expect(view.kind).toBe('empty')
  })

  it('works for any source payload — air readings included', () => {
    const meta = {
      source: 'open-meteo' as const,
      sourceUrl: OPENMETEO_SOURCE_URL,
      fetchedAt: NOW,
    }
    const view = envelopeView(makeEnvelope('ok', null, meta), NOW)
    expect(view.kind).toBe('empty')
  })
})
