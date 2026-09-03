/**
 * The worker URL handed to MapLibre is a serving contract: it must point at the
 * verbatim public/maplibre pair (self-contained, shipped by copy:maplibre-worker
 * on every build). A bundler-emitted ?url copy instead strands the worker's
 * relative import where the shared chunk is never emitted — the worker pool
 * never boots and the map renders nothing under static hosting.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('maplibre-gl', async () => await import('../test/maplibre-mock'))

describe('maplibre worker URL', () => {
  it('points at the self-contained public pair', async () => {
    const { setWorkerUrl } = await import('../test/maplibre-mock')
    // maplibre-style calls setWorkerUrl at module scope; the first evaluation
    // must therefore happen after the mock above is registered.
    await import('./maplibre-style')
    expect(setWorkerUrl).toHaveBeenCalledWith('/maplibre/maplibre-gl-worker.mjs')
  })
})
