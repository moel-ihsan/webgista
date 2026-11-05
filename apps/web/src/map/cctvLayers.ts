import type {
  AddLayerObject,
  GeoJSONSource,
  Map as MapLibreMap,
  MapLayerMouseEvent,
} from 'maplibre-gl'

import type { CctvFeatureCollection } from './cctv'

export const CCTV_SOURCE_ID = 'data'
export const CCTV_CLUSTER_LAYER_ID = 'places'
export const CCTV_CLUSTER_COUNT_LAYER_ID = 'cluster-count'
export const CCTV_POINT_LAYER_ID = 'unclustered-point'

const LAYER_IDS = [CCTV_CLUSTER_LAYER_ID, CCTV_CLUSTER_COUNT_LAYER_ID, CCTV_POINT_LAYER_ID] as const

export function setCctvVisibility(
  map: Pick<MapLibreMap, 'getLayer' | 'setLayoutProperty'>,
  visible: boolean,
): void {
  for (const id of LAYER_IDS) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
  }
}

export function updateCctvSource(
  map: Pick<MapLibreMap, 'getSource'>,
  data: CctvFeatureCollection,
): void {
  const source = map.getSource(CCTV_SOURCE_ID) as GeoJSONSource | undefined
  source?.setData(data)
}

export function attachCctvLayers(
  map: MapLibreMap,
  data: () => CctvFeatureCollection,
  visible: () => boolean,
  compact: boolean,
  onSelect: (cameraId: string) => void,
  callbacks: { ready: () => void; error: (error: unknown) => void },
): () => void {
  let attached = true
  let styleRevision = 0
  let handlersAttached = false

  const handleClusterClick = (event: MapLayerMouseEvent) => {
    const feature = event.features?.[0]
    const clusterId = feature?.properties?.cluster_id
    const coordinates = feature?.geometry.type === 'Point' ? feature.geometry.coordinates : null
    const source = map.getSource(CCTV_SOURCE_ID) as GeoJSONSource | undefined
    if (typeof clusterId !== 'number' || !coordinates || !source) return

    const revision = styleRevision
    void source.getClusterExpansionZoom(clusterId)
      .then((zoom) => {
        if (!attached || revision !== styleRevision) return
        map.easeTo({ center: [coordinates[0], coordinates[1]], zoom })
      })
      .catch(() => undefined)
  }

  const handlePointClick = (event: MapLayerMouseEvent) => {
    const id = event.features?.[0]?.properties?.cctvId
    if (typeof id === 'string') onSelect(id)
  }
  const handleEnter = () => { map.getCanvas().style.cursor = 'pointer' }
  const handleLeave = () => { map.getCanvas().style.cursor = '' }

  const detachLayerHandlers = () => {
    if (!handlersAttached) return
    for (const layer of [CCTV_CLUSTER_LAYER_ID, CCTV_POINT_LAYER_ID]) {
      map.off('click', layer, layer === CCTV_CLUSTER_LAYER_ID ? handleClusterClick : handlePointClick)
      map.off('mouseenter', layer, handleEnter)
      map.off('mouseleave', layer, handleLeave)
    }
    handlersAttached = false
  }

  const restore = () => {
    const style = map.getStyle()
    if (!attached || !style) return

    styleRevision += 1
    const firstSymbolLayer = style.layers.find((layer) => layer.type === 'symbol')?.id
    try {
      const source = map.getSource(CCTV_SOURCE_ID) as GeoJSONSource | undefined
      if (!source) {
        map.addSource(CCTV_SOURCE_ID, {
          type: 'geojson',
          data: data(),
          cluster: true,
          clusterRadius: 50,
          clusterMaxZoom: 14,
        })
      } else {
        source.setData(data())
      }

      if (!map.getLayer(CCTV_CLUSTER_LAYER_ID)) {
        map.addLayer({
          id: CCTV_CLUSTER_LAYER_ID,
          type: 'circle',
          source: CCTV_SOURCE_ID,
          filter: ['has', 'point_count'],
          layout: { visibility: visible() ? 'visible' : 'none' },
          paint: {
            'circle-color': ['step', ['get', 'point_count'], '#51bbd6', 100, '#f1f075', 750, '#f28cb1'],
            'circle-radius': ['step', ['get', 'point_count'], 20, 100, 30, 750, 40],
          },
        } as AddLayerObject, firstSymbolLayer)
      }
      if (!map.getLayer(CCTV_CLUSTER_COUNT_LAYER_ID)) {
        map.addLayer({
          id: CCTV_CLUSTER_COUNT_LAYER_ID,
          type: 'symbol',
          source: CCTV_SOURCE_ID,
          filter: ['has', 'point_count'],
          layout: {
            'text-field': '{point_count_abbreviated}',
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
            'text-size': 12,
            visibility: visible() ? 'visible' : 'none',
          },
        } as AddLayerObject, firstSymbolLayer)
      }
      if (!map.getLayer(CCTV_POINT_LAYER_ID)) {
        map.addLayer({
          id: CCTV_POINT_LAYER_ID,
          type: 'circle',
          source: CCTV_SOURCE_ID,
          filter: ['!', ['has', 'point_count']],
          layout: { visibility: visible() ? 'visible' : 'none' },
          paint: {
            'circle-radius': 10,
            'circle-stroke-width': 1,
            'circle-stroke-color': '#fff',
            'circle-color': compact
              ? ['match', ['get', 'category'], 'Regular', 'green', 'Analytic', 'yellow', '#0000ff']
              : ['match', ['get', 'condition'], 'great', '#98fb98', 'good', '#0b6623', 'average', '#ffff00', 'poor', '#d4a328', 'bad', '#ff5f00', 'terrible', '#ff0000', '#0000ff'],
          },
        } as AddLayerObject, firstSymbolLayer)
      }

      setCctvVisibility(map, visible())
      detachLayerHandlers()
      map.on('click', CCTV_CLUSTER_LAYER_ID, handleClusterClick)
      map.on('click', CCTV_POINT_LAYER_ID, handlePointClick)
      map.on('mouseenter', CCTV_CLUSTER_LAYER_ID, handleEnter)
      map.on('mouseleave', CCTV_CLUSTER_LAYER_ID, handleLeave)
      map.on('mouseenter', CCTV_POINT_LAYER_ID, handleEnter)
      map.on('mouseleave', CCTV_POINT_LAYER_ID, handleLeave)
      handlersAttached = true
      callbacks.ready()
    } catch (error) {
      callbacks.error(error)
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
