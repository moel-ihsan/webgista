import { describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'

import { defaultMapStyleId, mapStyles } from '../config/app'
import type { BoundaryFeatureCollection } from './boundary'
import { attachBoundaryLayers, setBoundaryVisibility } from './boundaryLayers'
import { applyMapStyle, cleanupMap, listenForMapReadiness, mapFailure, mapLoadTimeout } from './maplibre'

const boundary: BoundaryFeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { KECAMATAN: 'Kuta Alam', Luas: 12 },
      geometry: { type: 'Polygon', coordinates: [[[95.3, 5.5], [95.4, 5.5], [95.4, 5.6], [95.3, 5.5]]] },
    },
  ],
}

describe('OpenFreeMap configuration', () => {
  it('keeps the four original labels and maps them to the selected OpenFreeMap styles', () => {
    expect(mapStyles.map(({ label }) => label)).toEqual(['Street', 'Light', 'Dark', 'Outdoor'])
    expect(mapStyles.map(({ url }) => url)).toEqual([
      'https://tiles.openfreemap.org/styles/liberty',
      'https://tiles.openfreemap.org/styles/positron',
      'https://tiles.openfreemap.org/styles/dark',
      'https://tiles.openfreemap.org/styles/bright',
    ])
    expect(defaultMapStyleId).toBe('street')

    const setStyle = vi.fn()
    for (const style of mapStyles) applyMapStyle({ setStyle }, style.id)
    expect(setStyle.mock.calls.map(([url]) => url)).toEqual(mapStyles.map(({ url }) => url))
  })
})

describe('MapLibre failure states', () => {
  it('distinguishes WebGL, style, and network failures without exposing raw details', () => {
    expect(mapFailure('WebGL2 context creation failed').type).toBe('webgl')
    expect(mapFailure('Could not load style sprite').type).toBe('style')

    const failure = mapFailure('HTTP 403 at https://example.test/?token=private-value')
    expect(failure.type).toBe('network')
    expect(failure.message).not.toContain('private-value')
  })

  it('provides a bounded loading failure when the style never finishes', () => {
    expect(mapLoadTimeout()).toMatchObject({
      type: 'style',
      title: 'Basemap loading timed out',
    })
  })
})

describe('MapLibre readiness listeners', () => {
  it('treats initial load and later style loads as readiness and removes both listeners', () => {
    const listeners = new Map<string, () => void>()
    const map = {
      on: vi.fn((event: string, handler: () => void) => listeners.set(event, handler)),
      off: vi.fn((event: string) => listeners.delete(event)),
      isStyleLoaded: () => false,
      getStyle: () => ({ layers: [{ id: 'background' }] }),
      triggerRepaint: vi.fn(),
    }
    const ready = vi.fn()
    const detach = listenForMapReadiness(map as never, ready)

    listeners.get('load')?.()
    listeners.get('style.load')?.()
    expect(ready).toHaveBeenCalledTimes(2)

    detach()
    expect(map.off).toHaveBeenCalledWith('load', expect.any(Function))
    expect(map.off).toHaveBeenCalledWith('style.load', expect.any(Function))
    expect(listeners.size).toBe(0)
  })

  it('reports readiness immediately when the style finished before listener registration', () => {
    const ready = vi.fn()
    const map = {
      on: vi.fn(),
      off: vi.fn(),
      isStyleLoaded: () => true,
    }

    listenForMapReadiness(map as never, ready)

    expect(ready).toHaveBeenCalledOnce()
  })

  it('releases the Vue loading state when the basemap rendered before readiness registration', async () => {
    const status = ref<'loading' | 'ready'>('loading')
    const loadingOverlayVisible = computed(() => status.value === 'loading')
    const map = {
      on: vi.fn(),
      off: vi.fn(),
      isStyleLoaded: () => true,
    }

    listenForMapReadiness(map as never, () => { status.value = 'ready' })
    await nextTick()

    expect(loadingOverlayVisible.value).toBe(false)
  })

  it('accepts the first rendered style frame while MapLibre still reports source loading', () => {
    const listeners = new Map<string, () => void>()
    const ready = vi.fn()
    const map = {
      on: vi.fn((event: string, handler: () => void) => listeners.set(event, handler)),
      off: vi.fn((event: string) => listeners.delete(event)),
      isStyleLoaded: () => false,
      getStyle: () => ({ layers: [{ id: 'background' }] }),
      triggerRepaint: vi.fn(),
    }

    const detach = listenForMapReadiness(map as never, ready)
    expect(ready).not.toHaveBeenCalled()
    expect(map.triggerRepaint).toHaveBeenCalledOnce()

    listeners.get('render')?.()
    expect(ready).toHaveBeenCalledOnce()
    expect(map.off).toHaveBeenCalledWith('render', expect.any(Function))

    detach()
    expect(listeners.size).toBe(0)
  })
})

describe('MapLibre boundary layer lifecycle', () => {
  it('registers immediately when GeoJSON arrives after style.load while tiles are still pending', () => {
    const sources = new Set<string>()
    const layers = new Set<string>()
    const onReady = vi.fn()
    const map = {
      getStyle: () => ({ layers: [] }),
      isStyleLoaded: () => false,
      getSource: (id: string) => (sources.has(id) ? {} : undefined),
      getLayer: (id: string) => (layers.has(id) ? {} : undefined),
      addSource: vi.fn((id: string) => sources.add(id)),
      addLayer: vi.fn((layer: { id: string }) => layers.add(layer.id)),
      setLayoutProperty: vi.fn(),
      setFeatureState: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    }

    const detach = attachBoundaryLayers(
      map as never,
      boundary,
      () => true,
      { move: vi.fn(), leave: vi.fn(), click: vi.fn() },
      onReady,
      vi.fn(),
    )

    expect(map.addSource).toHaveBeenCalledOnce()
    expect(map.addLayer).toHaveBeenCalledTimes(2)
    expect(onReady).toHaveBeenCalledOnce()
    detach()
  })

  it('registers after style.load even while tiles load, restores on style changes, and cleans handlers', () => {
    const sources = new Set<string>()
    const layers = new Set<string>()
    const listeners = new Map<string, (...args: never[]) => void>()
    const layerVisibility: string[] = []
    const layerPositions: (string | undefined)[] = []
    let styleDocumentLoaded = false
    const addSource = vi.fn((id: string) => sources.add(id))
    const addLayer = vi.fn((layer: { id: string; layout?: { visibility?: string } }, beforeId?: string) => {
      layers.add(layer.id)
      layerVisibility.push(layer.layout?.visibility ?? '')
      layerPositions.push(beforeId)
    })
    const map = {
      isStyleLoaded: () => false,
      getStyle: () => styleDocumentLoaded ? { layers: [{ id: 'place-labels', type: 'symbol' }] } : undefined,
      getSource: (id: string) => (sources.has(id) ? {} : undefined),
      getLayer: (id: string) => (layers.has(id) ? {} : undefined),
      addSource,
      addLayer,
      setLayoutProperty: vi.fn(),
      setFeatureState: vi.fn(),
      on: vi.fn((type: string, layerOrListener: string | ((...args: never[]) => void), listener?: (...args: never[]) => void) => {
        listeners.set(`${type}:${typeof layerOrListener === 'string' ? layerOrListener : ''}`, (listener ?? layerOrListener) as (...args: never[]) => void)
      }),
      off: vi.fn((type: string, layerOrListener: string | ((...args: never[]) => void)) => {
        listeners.delete(`${type}:${typeof layerOrListener === 'string' ? layerOrListener : ''}`)
      }),
      remove: vi.fn(),
    }
    const handlers = { move: vi.fn(), leave: vi.fn(), click: vi.fn() }
    const onReady = vi.fn()
    const onError = vi.fn()
    let visible = false

    const detach = attachBoundaryLayers(map as never, boundary, () => visible, handlers, onReady, onError)
    expect(addSource).not.toHaveBeenCalled()
    expect(addLayer).not.toHaveBeenCalled()
    expect(onReady).not.toHaveBeenCalled()

    styleDocumentLoaded = true
    listeners.get('style.load:')?.()
    expect(addSource).toHaveBeenCalledTimes(1)
    expect(addLayer).toHaveBeenCalledTimes(2)
    expect(layerVisibility).toEqual(['none', 'none'])
    expect(layerPositions).toEqual(['place-labels', 'place-labels'])
    expect(onReady).toHaveBeenCalledOnce()
    expect(onError).not.toHaveBeenCalled()
    expect(addSource).toHaveBeenCalledWith('banda-aceh-boundary', expect.objectContaining({ type: 'geojson' }))
    expect(addLayer.mock.calls.map(([layer]) => layer.id)).toEqual(['banda-aceh-fill', 'banda-aceh-outline'])

    visible = true
    map.setLayoutProperty.mockClear()
    setBoundaryVisibility(map as never, visible)
    expect(map.setLayoutProperty).toHaveBeenNthCalledWith(1, 'banda-aceh-fill', 'visibility', 'visible')
    expect(map.setLayoutProperty).toHaveBeenNthCalledWith(2, 'banda-aceh-outline', 'visibility', 'visible')
    map.setLayoutProperty.mockClear()
    setBoundaryVisibility(map as never, false)
    expect(map.setLayoutProperty).toHaveBeenNthCalledWith(1, 'banda-aceh-fill', 'visibility', 'none')
    expect(map.setLayoutProperty).toHaveBeenNthCalledWith(2, 'banda-aceh-outline', 'visibility', 'none')
    map.setLayoutProperty.mockClear()
    setBoundaryVisibility(map as never, true)

    for (let styleChange = 0; styleChange < 2; styleChange += 1) {
      sources.clear()
      layers.clear()
      styleDocumentLoaded = false
      styleDocumentLoaded = true
      listeners.get('style.load:')?.()
    }
    expect(addSource).toHaveBeenCalledTimes(3)
    expect(addLayer).toHaveBeenCalledTimes(6)
    expect(layerVisibility.slice(2)).toEqual(['visible', 'visible', 'visible', 'visible'])
    expect(map.on).toHaveBeenCalledTimes(10)
    expect(map.off).toHaveBeenCalledTimes(9)
    expect(onReady).toHaveBeenCalledTimes(3)

    const event = { features: [{ id: 1, properties: { KECAMATAN: 'Kecamatan Kuta Alam', Luas: 12 } }] }
    listeners.get('mousemove:banda-aceh-fill')?.(event as never)
    expect(map.setFeatureState).toHaveBeenCalledWith(
      { source: 'banda-aceh-boundary', id: 1 },
      { hover: true },
    )
    expect(handlers.move).toHaveBeenCalledWith(event)
    listeners.get('click:banda-aceh-fill')?.(event as never)
    expect(handlers.click).toHaveBeenCalledWith(event)
    listeners.get('mouseleave:banda-aceh-fill')?.(event as never)
    expect(map.setFeatureState).toHaveBeenLastCalledWith(
      { source: 'banda-aceh-boundary', id: 1 },
      { hover: false },
    )
    expect(handlers.leave).toHaveBeenCalledWith(event)

    cleanupMap(map as never, detach)
    expect(map.remove).toHaveBeenCalledOnce()
    expect(listeners.size).toBe(0)
  })

  it('reports a source or layer registration error instead of reporting boundary readiness', () => {
    const onReady = vi.fn()
    const onError = vi.fn()
    const map = {
      getStyle: () => ({ layers: [] }),
      getSource: () => undefined,
      getLayer: () => undefined,
      addSource: vi.fn(),
      addLayer: vi.fn(() => { throw new Error('source registration failed') }),
      setLayoutProperty: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    }

    const detach = attachBoundaryLayers(
      map as never,
      boundary,
      () => false,
      { move: vi.fn(), leave: vi.fn(), click: vi.fn() },
      onReady,
      onError,
    )
    expect(onReady).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledWith(expect.any(Error))
    detach()
  })
})
