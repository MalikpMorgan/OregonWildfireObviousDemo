import countiesJson from './counties.json'
import type { CountyResource } from './types'

/**
 * All 36 Oregon counties with their official evacuation-information and alert-signup
 * links, as verified live during the curation review recorded in `lastReviewed`.
 * See types.ts for the nullability contract of the two URL fields.
 */
export const counties: CountyResource[] = countiesJson

export const expectedCountyCount = 36
