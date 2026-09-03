/**
 * FeedResult-envelope fixtures for the map surface, derived from the API's recorded
 * upstream snapshots (api/tests/fixtures, captured 2026-09-03): same incident UFIs,
 * normalized fields, perimeter polygons, and fire-relevant alerts the /api routes
 * serve for those inputs. Keep values in sync with the recorded files.
 */

import { INCIWEB_SOURCE_URL, NWS_SOURCE_URL, WFIGS_SOURCE_URL } from './sources'
import type {
  FeedResult,
  FireAlert,
  FireIncident,
  FirePerimeter,
  IncidentNarrative,
} from './types'

export { INCIWEB_SOURCE_URL, NWS_SOURCE_URL, WFIGS_SOURCE_URL }

export const recordedIncidents: FireIncident[] = [
  {
    source: 'wfigs',
    sourceUrl: WFIGS_SOURCE_URL,
    fetchedAt: 1788394810457,
    incidentId: '2026-OR973S-000206',
    name: 'North Cayuse',
    county: 'Umatilla',
    acres: 4887,
    containmentPct: 97,
    cause: 'Human',
    updatedAt: '2026-09-03T00:20:10.457000Z',
    lat: 45.6830889010534,
    lon: -118.480630816009,
    inciwebId: null,
  },
  {
    source: 'wfigs',
    sourceUrl: WFIGS_SOURCE_URL,
    fetchedAt: 1788394810457,
    incidentId: '2026-ORVAD-260201',
    name: 'BIG GRASS',
    county: 'Malheur',
    acres: 578637,
    containmentPct: 94,
    cause: 'Natural',
    updatedAt: '2026-09-02T21:50:08.007000Z',
    lat: 42.6498057724059,
    lon: -117.303363051783,
    inciwebId: null,
  },
  {
    source: 'wfigs',
    sourceUrl: WFIGS_SOURCE_URL,
    fetchedAt: 1788394810457,
    incidentId: '2026-ORPRD-000098',
    name: '0098',
    county: 'Crook',
    acres: 0.1,
    containmentPct: null,
    cause: 'Natural',
    updatedAt: '2026-09-01T22:32:04.927000Z',
    lat: 44.1022215579704,
    lon: -120.838293910495,
    inciwebId: null,
  },
  {
    source: 'wfigs',
    sourceUrl: WFIGS_SOURCE_URL,
    fetchedAt: 1788394810457,
    incidentId: '2026-OR733S-000457',
    name: "Devil's Den",
    county: 'Douglas',
    acres: 0.5,
    containmentPct: null,
    cause: 'Undetermined',
    updatedAt: '2026-08-31T21:06:02.340000Z',
    lat: 43.2863422272037,
    lon: -123.529736681395,
    inciwebId: null,
  },
]

/** Recorded perimeters belong to incidents outside the trimmed points snapshot —
 * the map joins by incidentId and must tolerate unmatched keys. */
export const recordedPerimeters: FirePerimeter[] = [
  {
    incidentId: '2026-ORPRD-000480',
    polygons: [
      {
        type: 'Polygon',
        coordinates: [
          [
            [-120.572858211507, 45.1237442259454],
            [-120.573057134833, 45.1234615427708],
            [-120.573067604349, 45.1230741623058],
            [-120.571528666647, 45.1230316415151],
            [-120.569920793607, 45.122849837909],
            [-120.56904894045, 45.1225176594413],
            [-120.567982145458, 45.1218677066885],
            [-120.567233264527, 45.1210953846466],
            [-120.566633546266, 45.1204922688951],
            [-120.566103155652, 45.1194847757263],
            [-120.56595777975, 45.1186146258474],
            [-120.572858211507, 45.1237442259454],
          ],
        ],
      },
      {
        type: 'Polygon',
        coordinates: [
          [
            [-120.589932808469, 45.0301436829596],
            [-120.589533286418, 45.029618904829],
            [-120.58833997009, 45.0288327729779],
            [-120.586680378016, 45.0281998253961],
            [-120.585723710266, 45.0272556137776],
            [-120.585944837891, 45.026553716887],
            [-120.58667115567, 45.0265962529678],
            [-120.587338643983, 45.027126705916],
            [-120.588644494592, 45.0279695784066],
            [-120.589675999651, 45.028045717325],
            [-120.589858794911, 45.0273430043376],
            [-120.589932808469, 45.0301436829596],
          ],
        ],
      },
    ],
  },
  {
    incidentId: '2026-ORUMF-000298',
    polygons: [
      {
        type: 'Polygon',
        coordinates: [
          [
            [-119.565714124338, 44.8389572661539],
            [-119.565743472284, 44.8389500006793],
            [-119.565833064488, 44.8389790696399],
            [-119.565948044955, 44.8390457388927],
            [-119.565971394209, 44.8390681284428],
            [-119.565996206693, 44.8391034433226],
            [-119.566006650393, 44.839130147811],
            [-119.566027581596, 44.839168476248],
            [-119.566033927393, 44.8391972618597],
            [-119.566023637755, 44.8392280937259],
            [-119.5659769669, 44.8392530974029],
            [-119.565714124338, 44.8389572661539],
          ],
        ],
      },
      {
        type: 'Polygon',
        coordinates: [
          [
            [-119.561753666035, 44.8078921833821],
            [-119.561771333298, 44.8082127504291],
            [-119.561802179698, 44.8083151322478],
            [-119.561706249313, 44.8086157831259],
            [-119.561705900485, 44.8089193834894],
            [-119.561965666612, 44.8091519833892],
            [-119.561709899134, 44.809373700148],
            [-119.561711266387, 44.8096632666448],
            [-119.561705300098, 44.809958100199],
            [-119.561717699225, 44.8102494998664],
            [-119.5619824994, 44.8104600000506],
            [-119.561753666035, 44.8078921833821],
          ],
        ],
      },
    ],
  },
]

/** The two recorded Red Flag Warning rows — one zone-based (null geometry), one
 * with polygon geometry — exactly what the API serves after its fire-relevance filter. */
export const recordedAlerts: FireAlert[] = [
  {
    source: 'nws',
    sourceUrl: NWS_SOURCE_URL,
    fetchedAt: 1788394810457,
    nwsId: 'urn:oid:2.49.0.1.840.0.ce8ab46e042d97b48f2ae18e9be541b060fa522a.001.1',
    event: 'Red Flag Warning',
    areaDesc: 'Northern Rosebud/Northern Treasure Counties',
    expires: '2026-09-03T21:00:00-06:00',
    geometry: null,
  },
  {
    source: 'nws',
    sourceUrl: NWS_SOURCE_URL,
    fetchedAt: 1788394810457,
    nwsId: 'urn:oid:2.49.0.1.840.0.ce8ab46e042d97b48f2ae18e9be541b060fa522a.001.1',
    event: 'Red Flag Warning',
    areaDesc: 'Northern Rosebud/Northern Treasure Counties',
    expires: '2026-09-03T21:00:00-06:00',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [-90.76, 29.21],
          [-90.7, 29.24],
          [-90.65, 29.31],
          [-90.61, 29.34],
          [-90.57, 29.35],
          [-90.54, 29.39],
          [-90.46, 29.39],
          [-90.39, 29.35],
          [-90.35, 29.36],
          [-90.21, 29.21],
          [-90.22, 29.19],
          [-90.18, 29.1],
          [-90.2, 29.08],
          [-90.11, 28.43],
          [-90.69, 28.47],
          [-90.8, 29.01],
          [-90.76, 29.21],
        ],
      ],
    },
  },
]

export function makeFiresEnvelope(now: number): FeedResult<FireIncident> {
  return {
    status: 'ok',
    data: recordedIncidents,
    meta: { source: 'wfigs', sourceUrl: WFIGS_SOURCE_URL, fetchedAt: now },
  }
}

export function makePerimetersEnvelope(now: number): FeedResult<FirePerimeter> {
  return {
    status: 'ok',
    data: recordedPerimeters,
    meta: { source: 'wfigs', sourceUrl: WFIGS_SOURCE_URL, fetchedAt: now },
  }
}

export function makeAlertsEnvelope(now: number): FeedResult<FireAlert> {
  return {
    status: 'ok',
    data: recordedAlerts,
    meta: { source: 'nws', sourceUrl: NWS_SOURCE_URL, fetchedAt: now },
  }
}

export function makeFailedFiresEnvelope(now: number): FeedResult<FireIncident> {
  return {
    status: 'failed',
    data: null,
    error: 'WFIGS feed unavailable',
    meta: { source: 'wfigs', sourceUrl: WFIGS_SOURCE_URL, fetchedAt: now },
  }
}

export function makeStaleAlertsEnvelope(now: number): FeedResult<FireAlert> {
  return {
    status: 'stale',
    data: recordedAlerts,
    meta: { source: 'nws', sourceUrl: NWS_SOURCE_URL, fetchedAt: now - 30 * 60_000 },
  }
}

/** An incident with every optional field blank — the worst-case detail fixture. */
export const allNullIncident: FireIncident = {
  source: 'wfigs',
  sourceUrl: WFIGS_SOURCE_URL,
  fetchedAt: 1788394810457,
  incidentId: '2026-OR973S-000311',
  name: 'Cedar Creek',
  county: null,
  acres: null,
  containmentPct: null,
  cause: null,
  updatedAt: null,
  lat: 44.5,
  lon: -121.8,
  inciwebId: null,
}

/** Narrative content mirrors the API's recorded InciWeb snapshot (2026-09-03):
 * cleaned "Incident Overview" prose plus the parsed last-updated date. */
const NARRATIVE_SUMMARY =
  'The North Cayuse Fire is located on the Umatilla National Forest, ' +
  'approximately 12 miles east of Pilot Rock. Crews are mopping up along the ' +
  'perimeter and restoration work has begun.'

export function makeNarrativeEnvelope(now: number): FeedResult<IncidentNarrative> {
  return {
    status: 'ok',
    data: [
      {
        source: 'inciweb',
        sourceUrl: INCIWEB_SOURCE_URL,
        fetchedAt: now,
        incidentId: recordedIncidents[0].incidentId,
        inciwebId: 'OR973S',
        title: 'OR973S North Cayuse',
        summary: NARRATIVE_SUMMARY,
        lastUpdated: '2026-09-03',
        link: 'https://inciweb.wildfire.gov/incident-information/or973s-north-cayuse',
      },
    ],
    meta: { source: 'inciweb', sourceUrl: INCIWEB_SOURCE_URL, fetchedAt: now },
  }
}

/** The incident is not on InciWeb — the detail panel links the official page. */
export function makeEmptyNarrativeEnvelope(now: number): FeedResult<IncidentNarrative> {
  return {
    status: 'ok',
    data: [],
    meta: { source: 'inciweb', sourceUrl: INCIWEB_SOURCE_URL, fetchedAt: now },
  }
}

/** The narrative feed failed with no last-good copy. */
export function makeFailedNarrativeEnvelope(now: number): FeedResult<IncidentNarrative> {
  return {
    status: 'failed',
    data: null,
    error: 'InciWeb feed unavailable',
    meta: { source: 'inciweb', sourceUrl: INCIWEB_SOURCE_URL, fetchedAt: now },
  }
}
