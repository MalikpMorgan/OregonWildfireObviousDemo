/**
 * Vitest mock for maplibre-gl — jsdom has no WebGL, so component tests drive this
 * in-memory double instead. Loaded via `vi.mock('maplibre-gl', async () =>
 * await import('../test/maplibre-mock'))` in test files; tests import the classes
 * from here directly for typed access. Records map instances, source data, layer
 * ids, and captured handlers so tests can assert layer setup and simulate load/click.
 */
import { vi } from 'vitest'

export type MockHandler = (event?: unknown) => void

export interface MockGeoJsonSource {
  setData: ReturnType<typeof vi.fn>
  type: 'geojson'
}

export class MockMap {
  static instances: MockMap[] = []

  options: Record<string, unknown>
  private handlers = new Map<string, MockHandler[]>()
  private sources = new Map<string, MockGeoJsonSource>()
  private layers: string[] = []

  addSource = vi.fn((id: string) => {
    this.sources.set(id, { setData: vi.fn(), type: 'geojson' })
  })
  getSource = vi.fn((id: string): MockGeoJsonSource | undefined => this.sources.get(id))
  addLayer = vi.fn((layer: { id?: string }) => {
    if (layer?.id) this.layers.push(layer.id)
  })
  removeLayer = vi.fn((id: string) => {
    this.layers = this.layers.filter((layerId) => layerId !== id)
  })
  getLayer = vi.fn((id: string) => this.layers.find((layerId) => layerId === id))
  removeSource = vi.fn((id: string) => {
    this.sources.delete(id)
  })
  setFilter = vi.fn()
  flyTo = vi.fn()
  getZoom = vi.fn(() => 6)
  addControl = vi.fn()
  remove = vi.fn()

  constructor(options: Record<string, unknown>) {
    this.options = options
    MockMap.instances.push(this)
  }

  on(event: string, arg2?: MockHandler | string, arg3?: MockHandler): this {
    const key = typeof arg2 === 'string' ? `${event}:${arg2}` : event
    const handler = typeof arg2 === 'function' ? arg2 : arg3
    if (!handler) return this
    const existing = this.handlers.get(key) ?? []
    existing.push(handler)
    this.handlers.set(key, existing)
    return this
  }

  emit(event: string, payload?: unknown): void {
    for (const handler of this.handlers.get(event) ?? []) handler(payload)
  }

  clickLayer(layerId: string, payload?: unknown): void {
    for (const handler of this.handlers.get(`click:${layerId}`) ?? []) handler(payload)
  }

  sourceData(id: string): unknown[] {
    const source = this.sources.get(id)
    return source ? source.setData.mock.calls.map((call) => call[0]) : []
  }
}

export class MockPopup {
  static instances: MockPopup[] = []

  lngLat?: [number, number]
  html?: string

  setLngLat = vi.fn((lngLat: [number, number]) => {
    this.lngLat = lngLat
    return this
  })
  setHTML = vi.fn((html: string) => {
    this.html = html
    return this
  })
  addTo = vi.fn(() => {
    return this
  })
  remove = vi.fn()

  constructor() {
    MockPopup.instances.push(this)
  }
}

export class NavigationControl {}
export class AttributionControl {}

// maplibre-style.ts calls this at module scope; the double ignores it.
export const setWorkerUrl = vi.fn()

// Aliases matching maplibre-gl's real named exports, so components importing
// { Map, Popup } from 'maplibre-gl' resolve to the doubles under vi.mock.
export { MockMap as Map, MockPopup as Popup }

export default { Map: MockMap, Popup: MockPopup, NavigationControl, AttributionControl, setWorkerUrl }
