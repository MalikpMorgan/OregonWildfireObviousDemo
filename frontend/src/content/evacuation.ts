import evacuationJson from './evacuation.json'
import type { EvacuationContent, EvacuationLevel, EvacuationLevelColor } from './types'

function isEvacuationLevelColor(value: unknown): value is EvacuationLevelColor {
  return value === 'green' || value === 'yellow' || value === 'red'
}

function isEvacuationLevelNumber(value: unknown): value is 1 | 2 | 3 {
  return value === 1 || value === 2 || value === 3
}

/**
 * Runtime guard at the JSON boundary: JSON imports widen `level` and `color` to
 * `number`/`string`, so the union types are enforced here. Bad content fails fast
 * instead of rendering wrong.
 */
function parseEvacuationContent(json: unknown): EvacuationContent {
  if (typeof json !== 'object' || json === null) {
    throw new Error('evacuation.json must be an object')
  }
  const candidate = json as Record<string, unknown>
  if (typeof candidate.officialWordingUrl !== 'string') {
    throw new Error('evacuation.json.officialWordingUrl must be a string')
  }
  if (typeof candidate.officialWordingSource !== 'string') {
    throw new Error('evacuation.json.officialWordingSource must be a string')
  }
  if (!Array.isArray(candidate.levels)) {
    throw new Error('evacuation.json.levels must be an array')
  }
  const levels: EvacuationLevel[] = []
  for (const entry of candidate.levels) {
    const levelCandidate = entry as Record<string, unknown>
    if (!isEvacuationLevelNumber(levelCandidate.level)) {
      throw new Error(`evacuation.json level must be 1, 2, or 3: ${JSON.stringify(entry)}`)
    }
    if (!isEvacuationLevelColor(levelCandidate.color)) {
      throw new Error(
        `evacuation.json color must be green, yellow, or red: ${JSON.stringify(entry)}`,
      )
    }
    levels.push({ level: levelCandidate.level, color: levelCandidate.color })
  }
  return {
    officialWordingUrl: candidate.officialWordingUrl,
    officialWordingSource: candidate.officialWordingSource,
    levels,
  }
}

/**
 * Evacuation-level metadata keyed to the official wording in the i18n bundles.
 *
 * The Level 1–BE READY / 2–BE SET / 3–GO NOW! strings live in
 * `evacuation.levels.<level>.name` / `.description` (EN and ES). EN is quoted
 * verbatim from the state's official evacuations page (art_HT20xbhl §2.4); ES is
 * taken from the state's official Spanish evacuation graphics published on the
 * same page. Color mirrors the official map legend and never carries meaning
 * alone — level number and name always render with it.
 */
export const evacuation: EvacuationContent = parseEvacuationContent(evacuationJson)
