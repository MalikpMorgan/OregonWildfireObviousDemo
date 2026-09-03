import reliefJson from './relief.json'
import type { ReliefCategory, ReliefResource } from './types'

const RELIEF_CATEGORIES = ['shelter', 'assistance', 'information', 'restrictions'] as const

function isReliefCategory(value: unknown): value is ReliefCategory {
  return (RELIEF_CATEGORIES as readonly string[]).includes(value as string)
}

/**
 * Runtime guard at the JSON boundary: JSON imports widen `category` to `string`, so the
 * union type is enforced here. Bad content fails fast instead of rendering wrong.
 */
function isReliefResource(value: unknown): value is ReliefResource {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.id === 'string' &&
    isReliefCategory(candidate.category) &&
    typeof candidate.url === 'string' &&
    candidate.url.startsWith('https://') &&
    typeof candidate.name === 'string' &&
    (candidate.phone === null || typeof candidate.phone === 'string') &&
    typeof candidate.lastReviewed === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(candidate.lastReviewed) &&
    Array.isArray(candidate.sources) &&
    candidate.sources.every((source) => typeof source === 'string')
  )
}

function parseReliefResources(json: unknown): ReliefResource[] {
  if (!Array.isArray(json)) {
    throw new Error('relief.json must be an array of relief resources')
  }
  const parsed: ReliefResource[] = []
  for (const entry of json) {
    if (!isReliefResource(entry)) {
      throw new Error(
        `relief.json entry does not match the ReliefResource contract: ${JSON.stringify(entry)}`,
      )
    }
    parsed.push(entry)
  }
  return parsed
}

/**
 * Curated relief directory — state, federal, and nonprofit resources, each with
 * attribution and the date its link was last verified. Descriptions are i18n keys
 * under `relief.items.<id>.description`.
 */
export const reliefResources: ReliefResource[] = parseReliefResources(reliefJson)

/** Display order of relief categories in the UI. */
export const reliefCategoryOrder: ReliefCategory[] = [...RELIEF_CATEGORIES]
