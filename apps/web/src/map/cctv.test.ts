// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'

import type { CctvLocation } from '../domain/cctv'
import type { BoundaryFeatureCollection } from './boundary'
import { attachBoundaryLayers } from './boundaryLayers'
import {
  cctvPopupDetails,
  createCctvPopupContent,
  focusCctvLocation,
  mountPopupDemoVideo,
  mountPopupLiveDemoStream,
  searchCctvLocations,
  toCctvFeatureCollection,
} from './cctv'
import {
  attachCctvLayers,
  CCTV_CLUSTER_COUNT_LAYER_ID,
  CCTV_CLUSTER_LAYER_ID,
  CCTV_POINT_LAYER_ID,
  CCTV_SOURCE_ID,
  setCctvVisibility,
  updateCctvSource,
} from './cctvLayers'
import { trafficDemoVideos } from '../data/trafficDemo'
import { liveDemoStream } from '../data/liveDemoStreams'

const camera: CctvLocation = {
  id: 'camera-1',
  legacyId: null,
  agency: { id: 'agency-1', name: 'Dishub' },
  name: 'Kuta Alam Camera',
  address: 'Banda Aceh',
  category: 'analytic',
  longitude: 95.3238,
  latitude: 5.5483,
  snapshotUrl: null,
  publicStreamUrl: null,
  isActive: true,
}

function fakeMap() {
  const sources = new Map<string, Record<string, unknown>>()
  const layers = new Map<string, Record<string, unknown>>()
  const listeners = new Map<string, (...args: never[]) => unknown>()
  let styleAvailable = true
  const map = {
    getStyle: () => styleAvailable ? { layers: [{ id: 'labels', type: 'symbol' }] } : undefined,
    getSource: (id: string) => sources.get(id),
    getLayer: (id: string) => layers.get(id),
    addSource: vi.fn((id: string, source: Record<string, unknown>) => {
      sources.set(id, {
        ...source,
        setData: vi.fn(),
        getClusterExpansionZoom: vi.fn().mockResolvedValue(15),
      })
    }),
    addLayer: vi.fn((layer: Record<string, unknown>) => layers.set(String(layer.id), layer)),
    setLayoutProperty: vi.fn(),
    on: vi.fn((type: string, layerOrHandler: string | ((...args: never[]) => unknown), handler?: (...args: never[]) => unknown) => {
      const layer = typeof layerOrHandler === 'string' ? layerOrHandler : ''
      listeners.set(`${type}:${layer}`, (handler ?? layerOrHandler) as (...args: never[]) => unknown)
    }),
    off: vi.fn((type: string, layerOrHandler: string | ((...args: never[]) => unknown)) => {
      const layer = typeof layerOrHandler === 'string' ? layerOrHandler : ''
      listeners.delete(`${type}:${layer}`)
    }),
    getCanvas: () => ({ style: { cursor: '' } }),
    easeTo: vi.fn(),
    remove: vi.fn(),
    sources,
    layers,
    listeners,
    setStyleAvailable: (value: boolean) => { styleAvailable = value },
  }
  return map
}

describe('CCTV map data and interactions', () => {
  it('converts actual cameras to stable GeoJSON point features with the original No Data color key', () => {
    expect(toCctvFeatureCollection([camera])).toEqual({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        id: 'camera-1',
        properties: { cctvId: 'camera-1', name: 'Kuta Alam Camera', category: 'Analytic', condition: 'No Data' },
        geometry: { type: 'Point', coordinates: [95.3238, 5.5483] },
      }],
    })
  })

  it('shows only the persisted latest condition when one is available', () => {
    expect(toCctvFeatureCollection([{ ...camera, trafficCondition: 'poor' }]).features[0]?.properties.condition).toBe('poor')
    expect(cctvPopupDetails({ ...camera, trafficCondition: 'poor', trafficConditionSource: 'manual' })).toEqual(expect.arrayContaining([
      { label: 'Traffic condition', value: 'Poor' },
      { label: 'Condition source', value: 'Manual observation' },
    ]))
  })

  it('labels a live demo camera as No Data, independent of saved manual observations', () => {
    const streamCamera: CctvLocation = {
      ...camera,
      id: 'dec221d0-87ae-4194-a3ab-bf60eb4d041f',
      trafficCondition: null,
      trafficConditionSource: 'youtube_demo_unanalyzed',
    }
    expect(toCctvFeatureCollection([streamCamera]).features[0]?.properties.condition).toBe('No Data')
    expect(cctvPopupDetails(streamCamera)).toContainEqual({ label: 'Traffic condition', value: 'No Data' })
    expect(cctvPopupDetails(streamCamera)).toContainEqual({ label: 'Condition source', value: 'YouTube demo — no traffic measurement' })
  })

  it('searches names, addresses, and agencies case-insensitively with partial matches', () => {
    expect(searchCctvLocations([camera], 'KUTA')).toEqual([camera])
    expect(searchCctvLocations([camera], 'banda')).toEqual([camera])
    expect(searchCctvLocations([camera], 'dish')).toEqual([camera])
    expect(searchCctvLocations([camera], 'no match')).toEqual([])
    expect(searchCctvLocations([camera], '  ')).toEqual([camera])
  })

  it('keeps popup values plain and reports unavailable video and traffic honestly', () => {
    expect(cctvPopupDetails(camera)).toEqual(expect.arrayContaining([
      { label: 'Traffic condition', value: 'No Data' },
      { label: 'Video', value: 'No authorized video is attached' },
    ]))
  })

  it('builds a v1-sized popup with signed image preview and safe text-only metadata', () => {
    const unsafeName = '<img src=x onerror=alert(1)>'
    const popup = createCctvPopupContent({ ...camera, name: unsafeName, snapshotUrl: 'https://signed.example/photo' })
    expect(popup.querySelector('h2')?.textContent).toBe(unsafeName)
    expect(popup.querySelectorAll('img')).toHaveLength(1)
    expect(popup.querySelector('img')?.src).toBe('https://signed.example/photo')
    expect(popup.textContent).toContain('Traffic condition: No Data')
    expect(popup.querySelector('.cctv-map-popup__view')?.getAttribute('href')).toBe('/cctv/camera-1')
    expect(popup.querySelector('.cctv-map-popup__view')?.textContent).toBe('View CCTV')

    const noImage = createCctvPopupContent(camera)
    expect(noImage.querySelector('.cctv-map-popup__media-note')?.textContent).toBe('Video unavailable in this release.')
    expect(noImage.querySelector('img')).toBeNull()
  })

  it('labels a marker condition derived from a demo ROI result as experimental', () => {
    expect(cctvPopupDetails({ ...camera, trafficCondition: 'great', trafficConditionSource: 'experimental_v1_estimate' }))
      .toContainEqual({ label: 'Condition source', value: 'Experimental V1-style estimate — demo video' })
  })

  it('mounts a muted looping preview only in the active popup and releases its media source on close', () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    const popup = createCctvPopupContent({ ...camera, snapshotUrl: 'https://signed.example/image.jpg' })
    const cleanup = mountPopupDemoVideo(popup, { ...camera, snapshotUrl: 'https://signed.example/image.jpg' }, trafficDemoVideos[0]!)
    const video = popup.querySelector('video')
    expect(video?.getAttribute('src')).toBe('/traffic-demo/traffic_sample_01.mp4')
    expect(video).toMatchObject({ autoplay: true, muted: true, loop: true, playsInline: true, preload: 'none' })
    expect(video?.poster).toBe('https://signed.example/image.jpg')
    expect(popup.textContent).toContain('DEMO VIDEO — NOT LIVE CCTV')
    expect(popup.textContent).toContain(`Video: Demo video: ${trafficDemoVideos[0]!.title}`)
    expect(play).toHaveBeenCalledOnce()
    cleanup()
    expect(video?.getAttribute('src')).toBeNull()
    expect(video?.paused).toBe(true)
    play.mockRestore()
  })

  it('falls back to the authorized thumbnail when the preview video errors', () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    const popup = createCctvPopupContent({ ...camera, snapshotUrl: 'https://signed.example/image.jpg' })
    mountPopupDemoVideo(popup, { ...camera, snapshotUrl: 'https://signed.example/image.jpg' }, trafficDemoVideos[1]!)
    popup.querySelector('video')?.dispatchEvent(new Event('error'))
    expect(popup.querySelector('video')).toBeNull()
    expect(popup.querySelector('img')?.src).toBe('https://signed.example/image.jpg')
    expect(popup.textContent).toContain('Video: Demo video unavailable')
    vi.restoreAllMocks()
  })

  it('offers an accessible play control when browser autoplay is rejected', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new Error('autoplay blocked'))
    const popup = createCctvPopupContent(camera)
    const cleanup = mountPopupDemoVideo(popup, camera, trafficDemoVideos[0]!)
    await Promise.resolve()
    const button = popup.querySelector<HTMLButtonElement>('.cctv-map-popup__play')
    expect(button?.textContent).toBe('Play demo video')
    cleanup()
    vi.restoreAllMocks()
  })

  it('mounts the fixed YouTube live embed only in the active popup and stops it on close', () => {
    const stream = liveDemoStream('camera-1', 'https://www.youtube.com/watch?v=UTR-nG4SK7E')!
    const popup = createCctvPopupContent(camera)
    const cleanup = mountPopupLiveDemoStream(popup, camera, stream)
    const iframe = popup.querySelector<HTMLIFrameElement>('iframe')
    expect(iframe?.src).toBe(stream.embedUrl)
    expect(iframe?.allow).toContain('autoplay')
    expect(iframe?.title).toContain('YouTube')
    expect(popup.textContent).toContain('DEMO · YouTube live')
    cleanup()
    expect(iframe?.getAttribute('src')).toBe('about:blank')
    expect(popup.querySelector('iframe')).toBeNull()
  })

  it('focuses a selected camera using its coordinates and leaves room beside the open drawer', () => {
    const map = { flyTo: vi.fn() }
    const showPopup = vi.fn()
    focusCctvLocation(map, camera, true, showPopup)
    expect(map.flyTo).toHaveBeenCalledWith({
      center: [95.3238, 5.5483], zoom: 16, offset: [-150, 0], essential: true,
    })
    expect(showPopup).toHaveBeenCalledWith(camera)
  })
})

describe('CCTV MapLibre layers', () => {
  it('registers the original clustered source and marker layer identifiers', () => {
    const map = fakeMap()
    const data = toCctvFeatureCollection([camera])
    const detach = attachCctvLayers(map as never, () => data, () => true, false, vi.fn(), { ready: vi.fn(), error: vi.fn() })

    expect(map.addSource).toHaveBeenCalledWith(CCTV_SOURCE_ID, expect.objectContaining({
      cluster: true, clusterRadius: 50, clusterMaxZoom: 14,
    }))
    expect(map.addLayer.mock.calls.map(([layer]) => layer.id)).toEqual([
      CCTV_CLUSTER_LAYER_ID,
      CCTV_CLUSTER_COUNT_LAYER_ID,
      CCTV_POINT_LAYER_ID,
    ])
    expect(map.addLayer.mock.calls[2]?.[0]).toMatchObject({
      paint: { 'circle-color': ['match', ['get', 'condition'], 'great', '#98fb98', 'good', '#0b6623', 'average', '#ffff00', 'poor', '#d4a328', 'bad', '#ff5f00', 'terrible', '#ff0000', '#0000ff'] },
    })
    detach()
  })

  it('retains the v1 dashboard category marker colors without assigning traffic conditions', () => {
    const map = fakeMap()
    const detach = attachCctvLayers(
      map as never,
      () => toCctvFeatureCollection([camera]),
      () => true,
      true,
      vi.fn(),
      { ready: vi.fn(), error: vi.fn() },
    )
    expect(map.addLayer.mock.calls[2]?.[0]).toMatchObject({
      paint: { 'circle-color': ['match', ['get', 'category'], 'Regular', 'green', 'Analytic', 'yellow', '#0000ff'] },
    })
    expect(toCctvFeatureCollection([camera]).features[0]?.properties.condition).toBe('No Data')
    detach()
  })

  it('toggles CCTV layers independently of other map layers', () => {
    const map = fakeMap()
    for (const id of [CCTV_CLUSTER_LAYER_ID, CCTV_CLUSTER_COUNT_LAYER_ID, CCTV_POINT_LAYER_ID, 'banda-aceh-fill']) {
      map.layers.set(id, { id })
    }

    setCctvVisibility(map as never, false)
    expect(map.setLayoutProperty).toHaveBeenCalledTimes(3)
    expect(map.setLayoutProperty).not.toHaveBeenCalledWith('banda-aceh-fill', 'visibility', 'none')
    setCctvVisibility(map as never, true)
    expect(map.setLayoutProperty).toHaveBeenLastCalledWith(CCTV_POINT_LAYER_ID, 'visibility', 'visible')
  })

  it('updates a loaded source when data arrives after style readiness', () => {
    const map = fakeMap()
    const detach = attachCctvLayers(map as never, () => toCctvFeatureCollection([]), () => true, false, vi.fn(), { ready: vi.fn(), error: vi.fn() })
    const source = map.sources.get(CCTV_SOURCE_ID)
    const nextData = toCctvFeatureCollection([camera])

    updateCctvSource(map as never, nextData)
    updateCctvSource(map as never, nextData)
    expect(source?.setData).toHaveBeenCalledWith(nextData)
    expect(source?.setData).toHaveBeenCalledTimes(2)
    expect(map.addSource).toHaveBeenCalledTimes(1)
    detach()
  })

  it('registers data that arrives before the initial style is ready', () => {
    const map = fakeMap()
    map.setStyleAvailable(false)
    let data = toCctvFeatureCollection([])
    const detach = attachCctvLayers(map as never, () => data, () => true, false, vi.fn(), {
      ready: vi.fn(), error: vi.fn(),
    })
    expect(map.addSource).not.toHaveBeenCalled()

    data = toCctvFeatureCollection([camera])
    map.setStyleAvailable(true)
    map.listeners.get('style.load:')?.()
    expect(map.addSource).toHaveBeenCalledWith(CCTV_SOURCE_ID, expect.objectContaining({ data }))
    detach()
  })

  it('expands clusters and selects points, restores after style changes without duplicate handlers, then cleans up', async () => {
    const map = fakeMap()
    const select = vi.fn()
    let visible = false
    const detach = attachCctvLayers(map as never, () => toCctvFeatureCollection([camera]), () => visible, false, select, { ready: vi.fn(), error: vi.fn() })

    const cluster = map.listeners.get(`click:${CCTV_CLUSTER_LAYER_ID}`)
    await cluster?.({ features: [{ properties: { cluster_id: 4 }, geometry: { type: 'Point', coordinates: [95.3, 5.5] } }] } as never)
    await Promise.resolve()
    expect(map.easeTo).toHaveBeenCalledWith({ center: [95.3, 5.5], zoom: 15 })

    map.listeners.get(`click:${CCTV_POINT_LAYER_ID}`)?.({ features: [{ properties: { cctvId: 'camera-1' } }] } as never)
    expect(select).toHaveBeenCalledWith('camera-1')

    visible = true
    for (let styleChange = 0; styleChange < 3; styleChange += 1) {
      map.sources.clear()
      map.layers.clear()
      map.listeners.get('style.load:')?.()
    }
    expect(map.addSource).toHaveBeenCalledTimes(4)
    expect(map.addLayer).toHaveBeenCalledTimes(12)
    expect([...map.listeners.keys()].filter((key) => key.startsWith('click:'))).toHaveLength(2)

    detach()
    expect(map.listeners.size).toBe(0)
    expect(map.sources.has(CCTV_SOURCE_ID)).toBe(true)
  })

  it('coexists with administrative boundary source and layers and detaches both handlers', () => {
    const map = fakeMap()
    const boundary: BoundaryFeatureCollection = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: { KECAMATAN: 'Kuta Alam' },
        geometry: { type: 'Polygon', coordinates: [[[95.3, 5.5], [95.4, 5.5], [95.4, 5.6], [95.3, 5.5]]] },
      }],
    }
    const detachCctv = attachCctvLayers(map as never, () => toCctvFeatureCollection([camera]), () => true, false, vi.fn(), {
      ready: vi.fn(), error: vi.fn(),
    })
    const detachBoundary = attachBoundaryLayers(
      map as never,
      boundary,
      () => true,
      { move: vi.fn(), leave: vi.fn(), click: vi.fn() },
      vi.fn(),
      vi.fn(),
    )

    expect(map.sources.has(CCTV_SOURCE_ID)).toBe(true)
    expect(map.sources.has('banda-aceh-boundary')).toBe(true)
    expect(map.layers.has(CCTV_POINT_LAYER_ID)).toBe(true)
    expect(map.layers.has('banda-aceh-fill')).toBe(true)
    detachCctv()
    detachBoundary()
    expect(map.listeners.size).toBe(0)
  })
})
