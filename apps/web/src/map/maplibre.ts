import type { Map as MapLibreMap } from 'maplibre-gl'

import { mapStyles, type MapStyleId } from '../config/app'

export interface MapFailure {
  type: 'webgl' | 'style' | 'network' | 'initialization'
  title: string
  message: string
}

export function applyMapStyle(map: Pick<MapLibreMap, 'setStyle'>, styleId: MapStyleId): void {
  const style = mapStyles.find((item) => item.id === styleId)
  if (style) map.setStyle(style.url)
}

export function listenForMapReadiness(
  map: Pick<MapLibreMap, 'on' | 'off' | 'isStyleLoaded' | 'getStyle' | 'triggerRepaint'>,
  ready: () => void,
): () => void {
  const onStyleReady = () => {
    map.off('render', onFirstRender)
    ready()
  }
  const onFirstRender = () => {
    if (!map.getStyle()?.layers?.length) return
    map.off('render', onFirstRender)
    ready()
  }

  map.on('style.load', onStyleReady)
  map.on('load', onStyleReady)
  map.on('render', onFirstRender)
  if (map.isStyleLoaded()) onStyleReady()
  else map.triggerRepaint()
  return () => {
    map.off('style.load', onStyleReady)
    map.off('load', onStyleReady)
    map.off('render', onFirstRender)
  }
}

export function mapFailure(message: string): MapFailure {
  const normalized = message.toLowerCase()

  if (/webgl|gpuinitialization/.test(normalized)) {
    return {
      type: 'webgl',
      title: 'WebGL2 is unavailable',
      message: 'Use a browser with WebGL2 enabled and hardware acceleration available.',
    }
  }
  if (/style|sprite|stylesheet|glyph/.test(normalized)) {
    return {
      type: 'style',
      title: 'Basemap style could not load',
      message: 'Check the selected OpenFreeMap style and network connection.',
    }
  }
  if (/network|fetch|request|http|tile|timeout|load failed/.test(normalized)) {
    return {
      type: 'network',
      title: 'Basemap resources could not load',
      message: 'Check the network connection. Some map details may be unavailable.',
    }
  }
  return {
    type: 'initialization',
    title: 'Map initialization failed',
    message: 'The map could not initialize. Check browser WebGL2 support and try again.',
  }
}

export function mapLoadTimeout(): MapFailure {
  return {
    type: 'style',
    title: 'Basemap loading timed out',
    message: 'Check the OpenFreeMap style service and network connection, then select the style again.',
  }
}

export function cleanupMap(map: MapLibreMap | null, detachBoundary: (() => void) | null): void {
  detachBoundary?.()
  map?.remove()
}
