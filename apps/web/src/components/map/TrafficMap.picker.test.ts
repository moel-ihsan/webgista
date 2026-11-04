// @vitest-environment happy-dom
import { createApp, defineComponent, h, nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mapHarness = vi.hoisted(() => ({
  styleLoaded: false,
  failMarkerAdd: false,
  authStatus: 'loading',
  supabaseClient: null as unknown,
  instances: [] as Array<Record<string, unknown>>,
  markers: [] as Array<Record<string, unknown>>,
}))

vi.mock('maplibre-gl', () => {
  class TestMap {
    readonly listeners = new globalThis.Map<string, (...args: unknown[]) => void>()
    readonly container: HTMLElement
    readonly canvas: HTMLCanvasElement
    removed = false
    center: unknown
    zoom = 11

    constructor(options: { container: HTMLElement; center: unknown; zoom?: number }) {
      this.container = options.container
      this.center = options.center
      this.zoom = options.zoom ?? 11
      this.container.classList.add('maplibregl-map')
      this.canvas = document.createElement('canvas')
      this.canvas.width = 1038
      this.canvas.height = 860
      this.container.append(this.canvas)
      mapHarness.instances.push(this as unknown as Record<string, unknown>)
    }

    on(event: string, handler: (...args: unknown[]) => void) { this.listeners.set(event, handler) }
    off(event: string, handler: (...args: unknown[]) => void) {
      if (this.listeners.get(event) === handler) this.listeners.delete(event)
    }
    isStyleLoaded() { return mapHarness.styleLoaded }
    getStyle() { return { version: 8, sources: {}, layers: [{ id: 'background' }] } }
    triggerRepaint() {}
    getCanvas() { return this.canvas }
    getCenter() {
      const [lng, lat] = this.center as [number, number]
      return { lng, lat }
    }
    getZoom() { return this.zoom }
    jumpTo(options: { center: [number, number]; zoom?: number }) {
      this.center = options.center
      if (options.zoom !== undefined) this.zoom = options.zoom
      this.listeners.get('moveend')?.()
      return this
    }
    easeTo(options: { center?: [number, number]; zoom?: number }) {
      if (options.center) this.center = options.center
      if (options.zoom !== undefined) this.zoom = options.zoom
      this.listeners.get('moveend')?.()
      return this
    }
    addControl() {
      const control = document.createElement('div')
      control.className = 'maplibregl-ctrl'
      this.container.append(control)
      return this
    }
    remove() {
      this.removed = true
      this.listeners.clear()
      this.container.replaceChildren()
    }
  }

  class TestMarker {
    coordinates: unknown = null
    removed = false
    readonly operations: string[] = []
    constructor() { mapHarness.markers.push(this as unknown as Record<string, unknown>) }
    addTo() {
      this.operations.push('addTo')
      if (!Array.isArray(this.coordinates) || mapHarness.failMarkerAdd) {
        throw new TypeError("Cannot read properties of undefined (reading 'lng')")
      }
      return this
    }
    setLngLat(coordinates: unknown) {
      this.operations.push('setLngLat')
      if (!Array.isArray(coordinates) || coordinates.length !== 2) {
        throw new TypeError('Invalid marker coordinates')
      }
      const [longitude, latitude] = coordinates
      if (typeof longitude !== 'number' || typeof latitude !== 'number'
        || !Number.isFinite(longitude) || !Number.isFinite(latitude)
        || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
        throw new TypeError('Invalid marker coordinates')
      }
      this.coordinates = coordinates
      return this
    }
    remove() { this.operations.push('remove'); this.removed = true }
  }

  class TestControl {}
  class TestPopup {}
  class TestGpuError extends Error {}

  return {
    Map: TestMap,
    Marker: TestMarker,
    Popup: TestPopup,
    AttributionControl: TestControl,
    NavigationControl: TestControl,
    GeolocateControl: TestControl,
    ScaleControl: TestControl,
    GPUInitializationError: TestGpuError,
    setWorkerUrl: vi.fn(),
  }
})

vi.mock('../../auth/session', () => ({ authSession: { state: { get status() { return mapHarness.authStatus } } } }))
vi.mock('../../lib/supabase', () => ({ get supabaseClient() { return mapHarness.supabaseClient } }))
vi.mock('../../map/boundary', () => ({
  districtDetails: vi.fn(),
  loadBoundary: vi.fn(() => new Promise(() => undefined)),
}))

import TrafficMap from './TrafficMap.vue'

describe('TrafficMap coordinate picker component', () => {
  beforeEach(() => {
    mapHarness.styleLoaded = false
    mapHarness.failMarkerAdd = false
    mapHarness.authStatus = 'loading'
    mapHarness.supabaseClient = null
    mapHarness.instances = []
    mapHarness.markers = []
  })

  it('removes loading after a rendered style frame and supports coordinate selection', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const locationSelected = vi.fn()
    const coordinates = ref<[number, number]>([95.330911, 5.559729])
    const PickerHost = defineComponent({
      setup() {
        return () => h(TrafficMap, {
          compact: true,
          locationPicker: true,
          locationCoordinates: coordinates.value,
          onLocationSelected: (selected: [number, number]) => {
            locationSelected(selected)
            coordinates.value = selected
          },
        })
      },
    })
    const app = createApp(PickerHost)
    app.mount(host)
    await nextTick()

    const map = mapHarness.instances[0] as {
      canvas: HTMLCanvasElement
      container: HTMLElement
      listeners: Map<string, (...args: unknown[]) => void>
      removed: boolean
      center: unknown
    }
    const marker = mapHarness.markers[0] as { coordinates: unknown; removed: boolean; operations: string[] }
    expect(map.canvas.width).toBeGreaterThan(0)
    expect(map.container.querySelector('.maplibregl-ctrl')).not.toBeNull()
    expect(host.textContent).toContain('Loading map…')
    expect(marker.coordinates).toEqual([95.330911, 5.559729])
    expect(marker.operations.slice(0, 2)).toEqual(['setLngLat', 'addTo'])
    expect(host.textContent).not.toContain('No authorized CCTV locations')

    map.listeners.get('render')?.()
    await nextTick()
    expect(host.textContent).not.toContain('Loading map…')

    map.listeners.get('click')?.({ lngLat: { lng: 95.4, lat: 5.6 } })
    await nextTick()
    expect(locationSelected).toHaveBeenCalledWith([95.4, 5.6])
    expect(marker.coordinates).toEqual([95.4, 5.6])

    app.unmount()
    expect(map.removed).toBe(true)
    expect(marker.removed).toBe(true)
    expect(map.listeners.size).toBe(0)
    host.remove()
  })

  it('rejects invalid coordinates and places a marker after a valid coordinate update', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const coordinates = ref<[number, number]>([181, 5.559729])
    const PickerHost = defineComponent({
      setup() {
        return () => h(TrafficMap, { compact: true, locationPicker: true, locationCoordinates: coordinates.value })
      },
    })
    const app = createApp(PickerHost)
    app.mount(host)
    await nextTick()

    const map = mapHarness.instances[0] as { center: unknown; removed: boolean }
    expect(map.center).not.toEqual([181, 5.559729])
    expect(mapHarness.markers).toHaveLength(0)

    coordinates.value = [95.4, 5.6]
    await nextTick()
    const marker = mapHarness.markers[0] as { coordinates: unknown; operations: string[]; removed: boolean }
    expect(marker.coordinates).toEqual([95.4, 5.6])
    expect(marker.operations.slice(0, 2)).toEqual(['setLngLat', 'addTo'])

    coordinates.value = [Number.NaN, 5.6]
    await nextTick()
    expect(marker.removed).toBe(true)
    expect(host.textContent).not.toContain('Map initialization failed')

    app.unmount()
    expect(map.removed).toBe(true)
    host.remove()
  })

  it('shows a map error and cleans up when marker attachment fails', async () => {
    mapHarness.failMarkerAdd = true
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp(TrafficMap, {
      compact: true,
      locationPicker: true,
      locationCoordinates: [95.330911, 5.559729],
    })
    app.mount(host)
    await nextTick()

    const map = mapHarness.instances[0] as {
      listeners: Map<string, (...args: unknown[]) => void>
      removed: boolean
    }
    const marker = mapHarness.markers[0] as { operations: string[]; removed: boolean }
    expect(host.textContent).toContain('Map initialization failed')
    expect(host.textContent).not.toContain('Loading map…')
    expect(marker.operations).toEqual(['setLngLat', 'addTo', 'remove'])
    expect(marker.removed).toBe(true)
    expect(map.removed).toBe(true)
    expect(map.listeners.size).toBe(0)

    app.unmount()
    host.remove()
  })

  it('synchronizes the Settings center picker without CCTV data', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const viewport = ref({ latitude: 5.5483, longitude: 95.3238, zoom: 11.2 })
    const changed = vi.fn((next: { latitude: number; longitude: number; zoom: number }) => { viewport.value = next })
    const SettingsMap = defineComponent({
      setup() {
        return () => h(TrafficMap, {
          compact: true,
          mapCenterPicker: true,
          viewport: viewport.value,
          onViewportChanged: changed,
        })
      },
    })
    const app = createApp(SettingsMap)
    app.mount(host)
    await nextTick()

    const map = mapHarness.instances[0] as {
      center: [number, number]
      listeners: Map<string, (...args: unknown[]) => void>
      removed: boolean
      easeTo: (options: { center: [number, number]; zoom?: number }) => unknown
      jumpTo: (options: { center: [number, number]; zoom?: number }) => unknown
    }
    const marker = mapHarness.markers[0] as { coordinates: unknown; removed: boolean }
    expect(map.center).toEqual([95.3238, 5.5483])
    expect(marker.coordinates).toEqual([95.3238, 5.5483])
    expect(host.textContent).not.toContain('No authorized CCTV locations')

    map.listeners.get('render')?.()
    await nextTick()
    expect(host.textContent).not.toContain('Loading map…')

    map.listeners.get('click')?.({ lngLat: { lng: 95.330911, lat: 5.559729 } })
    await nextTick()
    expect(changed).toHaveBeenCalledWith({ latitude: 5.559729, longitude: 95.330911, zoom: 11.2 })
    expect(marker.coordinates).toEqual([95.330911, 5.559729])

    viewport.value = { latitude: 5.56, longitude: 95.34, zoom: 13 }
    await nextTick()
    expect(map.center).toEqual([95.34, 5.56])
    expect(marker.coordinates).toEqual([95.34, 5.56])

    app.unmount()
    expect(map.removed).toBe(true)
    expect(marker.removed).toBe(true)
    expect(map.listeners.size).toBe(0)
    host.remove()
  })

  it('uses the saved initial viewport in Dashboard and Map View instances', async () => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      abortSignal: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { latitude: 5.559729, longitude: 95.330911, zoom: 13 }, error: null }),
    }
    for (const method of ['select', 'eq', 'abortSignal'] as const) query[method].mockReturnValue(query)
    mapHarness.supabaseClient = { from: vi.fn().mockReturnValue(query) }

    const host = document.createElement('div')
    document.body.append(host)
    const Maps = defineComponent({
      setup() {
        return () => [h(TrafficMap, { compact: true }), h(TrafficMap)]
      },
    })
    const app = createApp(Maps)
    app.mount(host)
    for (let index = 0; index < 5; index += 1) { await Promise.resolve(); await nextTick() }

    expect(query.eq).toHaveBeenCalledTimes(2)
    expect(mapHarness.instances).toHaveLength(2)
    expect(mapHarness.instances.map((instance) => (instance as { center: unknown }).center)).toEqual([
      [95.330911, 5.559729],
      [95.330911, 5.559729],
    ])
    expect(mapHarness.instances.map((instance) => (instance as { zoom: number }).zoom)).toEqual([13, 13])

    app.unmount()
    host.remove()
  })

  it('falls back to Banda Aceh when the global settings request fails', async () => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      abortSignal: vi.fn(),
      maybeSingle: vi.fn().mockRejectedValue(new Error('network unavailable')),
    }
    for (const method of ['select', 'eq', 'abortSignal'] as const) query[method].mockReturnValue(query)
    mapHarness.supabaseClient = { from: vi.fn().mockReturnValue(query) }

    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp(TrafficMap, { compact: true })
    app.mount(host)
    for (let index = 0; index < 5; index += 1) { await Promise.resolve(); await nextTick() }

    const map = mapHarness.instances[0] as { center: unknown; zoom: number; removed: boolean }
    expect(query.eq).toHaveBeenCalledWith('id', 1)
    expect(map.center).toEqual([95.3238, 5.5483])
    expect(map.zoom).toBe(11.2)
    expect(host.textContent).not.toContain('Map initialization failed')

    app.unmount()
    expect(map.removed).toBe(true)
    host.remove()
  })

  it('does not fetch global map settings for the CCTV coordinate picker', async () => {
    const from = vi.fn()
    mapHarness.supabaseClient = { from }
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp(TrafficMap, { compact: true, locationPicker: true, locationCoordinates: [95.330911, 5.559729] })
    app.mount(host)
    await nextTick()

    expect(from).not.toHaveBeenCalled()
    expect((mapHarness.instances[0] as { center: unknown }).center).toEqual([95.330911, 5.559729])
    app.unmount()
    host.remove()
  })
})
