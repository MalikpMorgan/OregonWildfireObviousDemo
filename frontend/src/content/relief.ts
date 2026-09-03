import reliefJson from './relief.json'
import type { ReliefCategory, ReliefResource } from './types'

/**
 * Curated relief directory — state, federal, and nonprofit resources, each with
 * attribution and the date its link was last verified. Descriptions are i18n keys
 * under `relief.items.<id>.description`.
 */
export const reliefResources: ReliefResource[] = reliefJson

/** Display order of relief categories in the UI. */
export const reliefCategoryOrder: ReliefCategory[] = [
  'shelter',
  'assistance',
  'information',
  'restrictions',
]
