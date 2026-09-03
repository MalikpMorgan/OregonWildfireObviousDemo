import { describe, expect, it } from 'vitest'
import { counties, expectedCountyCount } from './counties'

/**
 * Oregon's 36 counties, in alphabetical order. The curated dataset must cover exactly
 * this set — no fewer, no more, no renames.
 */
const OREGON_COUNTIES = [
  'Baker',
  'Benton',
  'Clackamas',
  'Clatsop',
  'Columbia',
  'Coos',
  'Crook',
  'Curry',
  'Deschutes',
  'Douglas',
  'Gilliam',
  'Grant',
  'Harney',
  'Hood River',
  'Jackson',
  'Jefferson',
  'Josephine',
  'Klamath',
  'Lake',
  'Lane',
  'Lincoln',
  'Linn',
  'Malheur',
  'Marion',
  'Morrow',
  'Multnomah',
  'Polk',
  'Sherman',
  'Tillamook',
  'Umatilla',
  'Union',
  'Wallowa',
  'Wasco',
  'Washington',
  'Wheeler',
  'Yamhill',
]

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:'
  } catch {
    return false
  }
}

describe('curated county dataset (spec §Content layer)', () => {
  it('covers exactly the 36 Oregon counties with no duplicates', () => {
    expect(counties).toHaveLength(expectedCountyCount)
    expect(counties.map((entry) => entry.county)).toEqual(OREGON_COUNTIES)
  })

  it('keeps every URL https and well-formed', () => {
    for (const entry of counties) {
      for (const [field, url] of [
        ['evacuationInfoUrl', entry.evacuationInfoUrl],
        ['alertSignupUrl', entry.alertSignupUrl],
      ] as const) {
        // Null is allowed only when a link could not be verified — the expectation
        // below documents the current curation state (all 72 verified 2026-09-03).
        if (url !== null) {
          expect(isHttpUrl(url), `${entry.county}.${field} must be a valid https URL`).toBe(true)
        }
      }
    }
  })

  it('has a verified link for every county — omit-with-PR-note is the only exception', () => {
    const missing = counties.filter(
      (entry) => entry.evacuationInfoUrl === null || entry.alertSignupUrl === null,
    )
    // The 2026-09-03 curation verified both links for all 36 counties. If a link must
    // be dropped, record it in the PR body and update this expectation deliberately.
    expect(
      missing.map((entry) => entry.county),
      'counties with an unverified (null) link — must be noted in the PR body',
    ).toEqual([])
  })

  it('attributes every entry with sources and an ISO lastReviewed date', () => {
    for (const entry of counties) {
      expect(entry.sources.length, `${entry.county} needs at least one source`).toBeGreaterThan(0)
      for (const source of entry.sources) {
        expect(source.trim()).not.toBe('')
      }
      expect(entry.lastReviewed, `${entry.county}.lastReviewed must be an ISO date`).toMatch(
        ISO_DATE,
      )
    }
  })
})
