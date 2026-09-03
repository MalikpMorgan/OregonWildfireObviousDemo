/**
 * Curated relief & evacuation content — shape contracts (spec §Content layer).
 *
 * Content lives as structured JSON files versioned in this directory, human-reviewed,
 * never scraped. The CI link checker opens every URL in these files on each run; a dead
 * link fails the build rather than a user in an emergency.
 */

/**
 * One entry per Oregon county (all 36 curated at launch).
 *
 * `evacuationInfoUrl` and `alertSignupUrl` are nullable by design: when a county's
 * official page cannot be verified live at curation time, the field is omitted
 * (null) instead of guessed. Every link shipped must have resolved during the
 * curation review noted in `lastReviewed`.
 */
export interface CountyResource {
  county: string
  /** The county's official evacuation information page — verified live at curation. */
  evacuationInfoUrl: string | null
  /** The county's official emergency-alert signup — verified live at curation. */
  alertSignupUrl: string | null
  /** ISO date (YYYY-MM-DD) of the last human curation review. */
  lastReviewed: string
  /** Attribution for where each link was verified, e.g. the county OEM or the state portal. */
  sources: string[]
}

/** Relief directory grouping — the UI renders one section per category. */
export type ReliefCategory = 'shelter' | 'assistance' | 'information' | 'restrictions'

/** A curated state, federal, or nonprofit relief resource. */
export interface ReliefResource {
  /** Stable identifier — doubles as the i18n key stem (`relief.items.<id>`). */
  id: string
  category: ReliefCategory
  /** Official site URL — verified live at curation. */
  url: string
  /** Display name (organization's own name). */
  name: string
  /** Phone number exactly as the organization publishes it, if any. */
  phone: string | null
  /** ISO date (YYYY-MM-DD) of the last human curation review. */
  lastReviewed: string
  /** Attribution for where the link was verified. */
  sources: string[]
}

/** Map color for an evacuation level, as used on official Oregon evacuation maps. */
export type EvacuationLevelColor = 'green' | 'yellow' | 'red'

/**
 * One evacuation level. The official wording lives in the i18n bundles
 * (`evacuation.levels.<level>.name` / `.description`) in both EN and ES — the EN
 * strings are quoted verbatim from the state's official evacuations page and the
 * ES strings from the state's official Spanish evacuation graphics.
 */
export interface EvacuationLevel {
  level: 1 | 2 | 3
  color: EvacuationLevelColor
}

/** Curated evacuation metadata — the official source the wording is quoted from. */
export interface EvacuationContent {
  /** Official page the Level 1/2/3 wording is quoted from — verified live at curation. */
  officialWordingUrl: string
  officialWordingSource: string
  levels: EvacuationLevel[]
}
