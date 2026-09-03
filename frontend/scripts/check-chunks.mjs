#!/usr/bin/env node
/**
 * Build guard for emitted chunk integrity.
 *
 * Scans every .mjs/.js chunk under the build output and asserts that each
 * relative import — static `… from './x'`, side-effect `import './x'`, and
 * dynamic `import('./x')` — resolves to a file that exists inside dist. A chunk
 * whose dependency chain leaves dist serves 404 under any static host (e.g. the
 * FastAPI StaticFiles mount): the importing module never instantiates. For the
 * MapLibre tile worker that means the worker pool never boots and the map
 * renders nothing — invisible until a browser opens the deployed app. Running
 * as part of `npm run build` makes this exact regression fail the build instead
 * of a resident's browser.
 *
 * The verbatim MapLibre worker pair that setWorkerUrl points at (see
 * src/map/maplibre-style.ts) is also asserted: the worker's one relative import
 * resolves only while both files ship under dist/maplibre/.
 *
 * Usage: node scripts/check-chunks.mjs [dist-dir]
 * Exit codes: 0 = every relative import resolves, 1 = broken chunk graph or
 * empty/missing build output.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const DIST_DIR = resolve(SCRIPT_DIR, '..', process.argv[2] ?? 'dist')

/** The verbatim MapLibre worker pair every production build must ship. */
const WORKER_PAIR = ['maplibre/maplibre-gl-worker.mjs', 'maplibre/maplibre-gl-shared.mjs']

/** Module chunks are the only emitted files whose imports must resolve. */
const CHUNK_EXTENSIONS = new Set(['.js', '.mjs'])

/** Rooted/relative specifiers must resolve in dist; bare names and URLs are external. */
function isInternalSpecifier(specifier) {
  return specifier.startsWith('./') || specifier.startsWith('../') || specifier.startsWith('/')
}

/** Resolve a specifier the way a browser does from the importing chunk's URL. */
function resolveSpecifier(chunkPath, specifier) {
  const target = specifier.split(/[?#]/)[0]
  return target.startsWith('/')
    ? resolve(DIST_DIR, `.${target}`)
    : resolve(dirname(chunkPath), target)
}

/** A target exists as-is or with an implied .js/.mjs extension. */
function targetExists(resolved) {
  if (existsSync(resolved) && statSync(resolved).isFile()) return true
  if (/\.[cm]?js$/i.test(resolved)) return false
  return [`${resolved}.js`, `${resolved}.mjs`].some(
    (path) => existsSync(path) && statSync(path).isFile(),
  )
}

function isInsideDist(resolved) {
  return !relative(DIST_DIR, resolved).startsWith('..')
}

/**
 * Static import sites only. Over-approximating is allowed (a stray match that
 * happens to name a real missing file is worth surfacing); missing an emitted
 * import is not, so every import context gets its own pattern.
 */
const IMPORT_PATTERNS = [
  /\bfrom\s*(["'])([^"'\n]+)\1/g, // static import/export … from 'x'
  /\bimport\s*(["'])([^"'\n]+)\1/g, // side-effect import 'x'
  /\bimport\(\s*(["'])([^"'\n]+)\1/g, // dynamic import('x')
]

function extractImportSpecifiers(source) {
  const specifiers = new Set()
  for (const pattern of IMPORT_PATTERNS) {
    for (const match of source.matchAll(pattern)) {
      if (isInternalSpecifier(match[2])) specifiers.add(match[2])
    }
  }
  return [...specifiers]
}

function listChunks(dir) {
  const chunks = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      chunks.push(...listChunks(path))
    } else if (CHUNK_EXTENSIONS.has(extname(entry.name))) {
      chunks.push(path)
    }
  }
  return chunks
}

/** Scan every emitted chunk; report broken relative imports and the total scanned. */
function scanChunks() {
  const chunks = listChunks(DIST_DIR)
  const violations = []
  let scannedImports = 0
  for (const chunk of chunks) {
    const source = readFileSync(chunk, 'utf8')
    for (const specifier of extractImportSpecifiers(source)) {
      scannedImports += 1
      const resolved = resolveSpecifier(chunk, specifier)
      if (isInsideDist(resolved) && targetExists(resolved)) continue
      violations.push({ chunk, specifier, resolved })
    }
  }
  return { chunks, violations, scannedImports }
}

function missingWorkerPair() {
  return WORKER_PAIR.filter((relPath) => !targetExists(join(DIST_DIR, relPath)))
}

function main() {
  if (!existsSync(DIST_DIR)) {
    console.error(
      `Chunk check FAILED: build output not found at ${DIST_DIR} — run the build first.`,
    )
    process.exit(1)
  }

  const { chunks, violations, scannedImports } = scanChunks()
  if (chunks.length === 0) {
    console.error(`Chunk check FAILED: no .js/.mjs chunks emitted under ${DIST_DIR}.`)
    process.exit(1)
  }

  for (const { chunk, specifier, resolved } of violations) {
    console.error(
      `BROKEN IMPORT: ${relative(DIST_DIR, chunk)} imports '${specifier}'` +
        ` → ${relative(DIST_DIR, resolved) || '/'} does not exist in dist`,
    )
  }
  for (const relPath of missingWorkerPair()) {
    console.error(`MISSING WORKER FILE: dist/${relPath} — the MapLibre worker pair did not ship.`)
  }

  if (violations.length > 0 || missingWorkerPair().length > 0) {
    console.error(
      `\nChunk check FAILED: ${violations.length} broken import(s), ` +
        `${missingWorkerPair().length} missing worker file(s) — the deployed app would 404 mid-import.`,
    )
    process.exit(1)
  }

  console.log(
    `Chunk check PASSED: ${chunks.length} chunks, ${scannedImports} relative imports all resolve within dist.`,
  )
}

main()
