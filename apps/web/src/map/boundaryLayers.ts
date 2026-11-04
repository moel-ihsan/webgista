import type { Map as MapLibreMap, MapLayerMouseEvent } from 'maplibre-gl'

import type { BoundaryFeatureCollection } from './boundary'

const SOURCE_ID = 'banda-aceh-boundary'
const FILL_LAYER_ID = 'banda-aceh-fill'
const OUTLINE_LAYER_ID = 'banda-aceh-outline'
type FeatureId = string | number

export interface BoundaryHandlers {
  move: (event: MapLayerMouseEvent) => void
  leave: (event: MapLayerMouseEvent) => void
  click: (event: MapLayerMouseEvent) => void
}

export function setBoundaryVisibility(map: Pick<MapLibreMap, 'getLayer' | 'setLayoutProperty'>, visible: boolean): void {
  const visibility = visible ? 'visible' : 'none'
  if (map.getLayer(FILL_LAYER_ID)) map.setLayoutProperty(FILL_LAYER_ID, 'visibility', visibility)
  if (map.getLayer(OUTLINE_LAYER_ID)) map.setLayoutProperty(OUTLINE_LAYER_ID, 'visibility', visibility)
}

export function attachBoundaryLayers(
  map: MapLibreMap,
  boundary: BoundaryFeatureCollection,
  visible: () => boolean,
  handlers: BoundaryHandlers,
  onReady: () => void,
  onError: (error: unknown) => void,
): () => void {
  let attached = true
  let hoveredFeatureId: FeatureId | undefined

  const clearHover = () => {
    if (hoveredFeatureId !== undefined && map.getSource(SOURCE_ID)) {
      map.setFeatureState({ source: SOURCE_ID, id: hoveredFeatureId }, { hover: false })
    }
    hoveredFeatureId = undefined
  }
  const handleMove = (event: MapLayerMouseEvent) => {
    const featureId = (event.features?.[0] as { id?: FeatureId } | undefined)?.id
    if (hoveredFeatureId !== featureId) clearHover()
    if (featureId !== undefined) {
      map.setFeatureState({ source: SOURCE_ID, id: featureId }, { hover: true })
      hoveredFeatureId = featureId
    }
    handlers.move(event)
  }
  const handleLeave = (event: MapLayerMouseEvent) => {
    clearHover()
    handlers.leave(event)
  }

  const detachLayerHandlers = () => {
    map.off('mousemove', FILL_LAYER_ID, handleMove)
    map.off('mouseleave', FILL_LAYER_ID, handleLeave)
    map.off('click', FILL_LAYER_ID, handlers.click)
  }

  const restore = () => {
    // isStyleLoaded also waits for basemap tiles; the style document is enough to add these local layers.
    const style = map.getStyle()
    if (!attached || !style) return

    const firstSymbolLayer = style.layers.find((layer) => layer.type === 'symbol')?.id

    try {
      if (!map.getSource(SOURCE_ID)) {
        hoveredFeatureId = undefined
        map.addSource(SOURCE_ID, { type: 'geojson', data: boundary, generateId: true })
      }
      if (!map.getLayer(FILL_LAYER_ID)) {
        map.addLayer({
          id: FILL_LAYER_ID,
          type: 'fill',
          source: SOURCE_ID,
          layout: { visibility: visible() ? 'visible' : 'none' },
          paint: {
            'fill-color': [
              'interpolate', ['linear'], ['get', 'Luas'],
              0, '#b3cde0',
              400, '#6497b1',
              800, '#005b96',
              1000, '#03396c',
              10000, '#011f4b',
            ],
            'fill-outline-color': '#fff',
            'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.8, 0.5],
          },
        }, firstSymbolLayer)
      }
      if (!map.getLayer(OUTLINE_LAYER_ID)) {
        map.addLayer({
          id: OUTLINE_LAYER_ID,
          type: 'line',
          source: SOURCE_ID,
          layout: { visibility: visible() ? 'visible' : 'none' },
          paint: { 'line-color': '#fff', 'line-width': 1.6, 'line-opacity': 0.85 },
        }, firstSymbolLayer)
      }

      if (!map.getSource(SOURCE_ID) || !map.getLayer(FILL_LAYER_ID) || !map.getLayer(OUTLINE_LAYER_ID)) {
        throw new Error('Boundary source or layer registration failed.')
      }

      setBoundaryVisibility(map, visible())
      detachLayerHandlers()
      map.on('mousemove', FILL_LAYER_ID, handleMove)
      map.on('mouseleave', FILL_LAYER_ID, handleLeave)
      map.on('click', FILL_LAYER_ID, handlers.click)
      onReady()
    } catch (error) {
      onError(error)
    }
  }

  map.on('style.load', restore)
  if (map.getStyle()) restore()

  return () => {
    if (!attached) return
    attached = false
    map.off('style.load', restore)
    detachLayerHandlers()
  }
}
