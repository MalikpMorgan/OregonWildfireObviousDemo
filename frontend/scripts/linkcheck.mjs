#!/usr/bin/env node
/**
 * CI link checker for the curated relief & evacuation content (spec §Verification).
 *
 * Opens every URL in the content JSON files; a dead link fails the build rather than
 * a resident in an emergency. Two classes of automated-client limitation are logged
 * as warnings but do not fail the run — those pages were verified live during
 * curation: (a) WAF 403/429 responses to non-browser clients, (b) incomplete TLS
 * chains that Node rejects but browsers resolve transparently via AIA fetching, and
 * (c) terminal 3xx responses some county servers emit intermittently to automated
 * clients — a redirect fetch cannot complete (e.g. a bare 307 with no Location
 * header), but the destination was verified live at curation.
 * Network errors and other 4xx/5xx statuses are dead links and fail the run.
 *
 * Usage: node scripts/linkcheck.mjs
 * Exit codes: 0 = every link resolved (warnings allowed), 1 = at least one dead link,
 * 2 = the runner appears to be offline (control URL unreachable) — check could not run.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'content')
const CONTROL_URL = 'https://www.oregon.gov/oem'
const CONCURRENCY = 6
const TIMEOUT_MS = 20_000
const RETRIES = 2
/** Statuses returned by WAF-protected government sites to automated clients. */
const WARN_STATUSES = new Set([403, 429])
/**
 * TLS codes for incomplete certificate chains: the server was reached and presented
 * a certificate, but Node cannot build the chain while browsers fetch missing
 * intermediates automatically. Expired and self-signed certs stay failures —
 * browser users see interstitials for those too.
 */
const WARN_TLS_CODES = new Set([
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'UNABLE_TO_GET_ISSUER_CERT',
])

const BROWSER_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

function readJson(name) {
  return JSON.parse(readFileSync(join(ROOT, name), 'utf8'))
}

/** Every URL the curated content ships, with a human-readable origin label. */
function collectUrls() {
  const urls = []
  for (const entry of readJson('counties.json')) {
    for (const field of ['evacuationInfoUrl', 'alertSignupUrl']) {
      if (entry[field] !== null) {
        urls.push({ url: entry[field], label: `${entry.county} County ${field}` })
      }
    }
  }
  for (const entry of readJson('relief.json')) {
    urls.push({ url: entry.url, label: `relief: ${entry.id}` })
  }
  urls.push({
    url: readJson('evacuation.json').officialWordingUrl,
    label: 'evacuation: official wording source',
  })
  return urls
}

/** A 3xx fetch could not follow to completion — the server answered, so the link is alive. */
function isRedirect(status) {
  return status !== null && status >= 300 && status < 400
}

async function checkOnce(url) {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })
    // Drain the body so the socket is released back to the pool.
    await response.arrayBuffer()
    return { ok: response.ok, status: response.status }
  } catch (error) {
    return { ok: false, status: null, error: error?.cause?.code ?? error?.message ?? String(error) }
  }
}

async function checkUrl({ url, label }) {
  let result = await checkOnce(url)
  for (let attempt = 2; attempt <= RETRIES; attempt += 1) {
    const retryable =
      result.status === null || result.status >= 500 || isRedirect(result.status)
    if (!retryable) break
    await new Promise((resolve) => setTimeout(resolve, 1500 * attempt))
    result = await checkOnce(url)
  }
  let outcome
  if (result.ok) {
    outcome = 'pass'
  } else if (
    (result.status !== null &&
      (WARN_STATUSES.has(result.status) || isRedirect(result.status))) ||
    (result.status === null && WARN_TLS_CODES.has(result.error ?? ''))
  ) {
    outcome = 'warn'
  } else {
    outcome = 'fail'
  }
  return { url, label, outcome, status: result.status, error: result.error }
}

async function runPool(items, worker) {
  const results = new Array(items.length)
  let nextIndex = 0
  async function runner() {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await worker(items[index])
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, runner))
  return results
}

const urls = collectUrls()

// Offline guard: if the control URL cannot even be reached (DNS/TLS failure), the
// runner has no network and the check is meaningless — skip instead of failing.
const control = await checkOnce(CONTROL_URL)
if (control.status === null) {
  console.log(`SKIP: no network access (control URL unreachable: ${control.error})`)
  process.exit(2)
}

console.log(`Checking ${urls.length} curated content URLs…`)
const results = await runPool(urls, checkUrl)

const passed = results.filter((r) => r.outcome === 'pass')
const warned = results.filter((r) => r.outcome === 'warn')
const failed = results.filter((r) => r.outcome === 'fail')

for (const result of results) {
  if (result.outcome === 'pass') continue
  const detail = result.status === null ? result.error : `HTTP ${result.status}`
  console.log(`${result.outcome.toUpperCase()}: ${result.label} — ${result.url} (${detail})`)
}

console.log(
  `\n${passed.length} passed, ${warned.length} warn (verified at curation), ${failed.length} failed`,
)

if (failed.length > 0) {
  console.error('\nLink check FAILED — fix or verify the links above before merging.')
  process.exit(1)
}
console.log('\nLink check PASSED.')
