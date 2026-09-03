import evacuationJson from './evacuation.json'
import type { EvacuationContent } from './types'

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
export const evacuation: EvacuationContent = evacuationJson
