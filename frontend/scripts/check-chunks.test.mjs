// @vitest-environment node
/**
 * Behavioral tests for the dist chunk guard: it must catch the exact
 * MapLibre-worker serving regression (an emitted chunk importing a dependency
 * that was never emitted next to it) and pass a self-contained build output.
 * The guard runs as a spawned subprocess so the tests exercise the real CI
 * entrypoint, exit codes included.
 */
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'

const run = promisify(execFile)
const GUARD = fileURLToPath(new URL('./check-chunks.mjs', import.meta.url))

const WORKER_PAIR = {
  'maplibre/maplibre-gl-worker.mjs': 'import{e}from"./maplibre-gl-shared.mjs"\n',
  'maplibre/maplibre-gl-shared.mjs': 'export const e = {}\n',
}

/** Materialize a dist-like tree from {relativePath: content} and return its path. */
async function makeDist(files) {
  const root = await mkdtemp(join(tmpdir(), 'check-chunks-'))
  const dist = join(root, 'dist')
  for (const [relPath, content] of Object.entries(files)) {
    await mkdir(dirname(join(dist, relPath)), { recursive: true })
    await writeFile(join(dist, relPath), content)
  }
  return dist
}

async function runGuard(files) {
  const dist = await makeDist(files)
  try {
    const { stdout } = await run(process.execPath, [GUARD, dist], { encoding: 'utf8' })
    return { code: 0, stdout }
  } catch (error) {
    return { code: error.code, output: `${error.stdout ?? ''}${error.stderr ?? ''}` }
  }
}

describe('check-chunks build guard', () => {
  it('fails on the deployed regression: a hashed worker importing a dependency emitted elsewhere', async () => {
    const result = await runGuard({
      'assets/maplibre-gl-worker-CEDqQgJb.mjs': 'import{e}from"./maplibre-gl-shared.mjs"\n',
      // The shared chunk exists only under maplibre/ — /assets/ 404s in the browser.
      'maplibre/maplibre-gl-shared.mjs': 'export const e = {}\n',
      'maplibre/maplibre-gl-worker.mjs': 'import{e}from"./maplibre-gl-shared.mjs"\n',
    })
    expect(result.code).toBe(1)
    expect(result.output).toContain('assets/maplibre-gl-shared.mjs')
  })

  it('passes a self-contained chunk graph that ships the worker pair', async () => {
    const result = await runGuard({
      'assets/index-abc.mjs': 'import{a}from"./vendor-def.mjs"\nexport const b = a\n',
      'assets/vendor-def.mjs': 'export const a = 1\n',
      ...WORKER_PAIR,
    })
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('PASSED')
  })

  it('checks dynamic imports too', async () => {
    const result = await runGuard({
      'assets/index-abc.mjs': 'await import("./lazy-def.mjs")\n',
      ...WORKER_PAIR,
    })
    expect(result.code).toBe(1)
    expect(result.output).toContain('lazy-def')
  })

  it('resolves root-relative specifiers against the dist root', async () => {
    const result = await runGuard({
      'assets/index-abc.mjs': 'import{e}from"/maplibre/maplibre-gl-shared.mjs"\n',
      ...WORKER_PAIR,
    })
    expect(result.code).toBe(0)
  })

  it('fails when the maplibre worker pair is missing from dist', async () => {
    const result = await runGuard({
      'assets/index-abc.mjs': 'console.log(1)\n',
    })
    expect(result.code).toBe(1)
    expect(result.output).toContain('maplibre-gl-worker.mjs')
  })

  it('fails on an empty build output', async () => {
    const result = await runGuard({ 'README.txt': 'not a chunk\n' })
    expect(result.code).toBe(1)
    expect(result.output).toContain('no .js/.mjs chunks')
  })
})
