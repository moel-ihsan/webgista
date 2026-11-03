<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import {
  Map,
  NavigationControl,
  ScaleControl,
  setWorkerUrl,
  type MapLayerMouseEvent,
} from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

import { appConfig } from '../../config/app'
import { districtAreaLabel, loadBoundary } from '../../map/boundary'

setWorkerUrl(workerUrl)

type MapStatus = 'loading' | 'ready' | 'error'

const mapContainer = ref<HTMLElement | null>(null)
const status = ref<MapStatus>('loading')
const errorMessage = ref('')
const featureCount = ref(0)
const selectedDistrict = ref<{ name: string; area: string } | null>(null)

let map: Map | null = null

function selectDistrict(event: MapLayerMouseEvent): void {
  const properties = event.features?.[0]?.properties
  if (!properties || typeof properties.KECAMATAN !== 'string') return

  selectedDistrict.value = {
    name: properties.KECAMATAN,
    area: districtAreaLabel(properties.Luas),
  }

  if (map) map.getCanvas().style.cursor = 'pointer'
}

function clearDistrict(): void {
  selectedDistrict.value = null
  if (map) map.getCanvas().style.cursor = ''
}

onMounted(() => {
  if (!mapContainer.value) return

  map = new Map({
    container: mapContainer.value,
    style: appConfig.map.styleUrl,
    center: appConfig.map.center,
    zoom: appConfig.map.zoom,
    minZoom: 8,
    maxZoom: 18,
  })

  map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right')
  map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-right')

  map.once('load', async () => {
    try {
      const boundary = await loadBoundary(appConfig.map.boundaryUrl)
      if (!map) return

      featureCount.value = boundary.features.length
      map.addSource('banda-aceh-boundary', {
        type: 'geojson',
        data: boundary,
      })
      map.addLayer({
        id: 'banda-aceh-fill',
        type: 'fill',
        source: 'banda-aceh-boundary',
        paint: {
          'fill-color': '#17b890',
          'fill-opacity': 0.18,
        },
      })
      map.addLayer({
        id: 'banda-aceh-outline',
        type: 'line',
        source: 'banda-aceh-boundary',
        paint: {
          'line-color': '#7be0c3',
          'line-width': 1.6,
        },
      })

      map.on('mousemove', 'banda-aceh-fill', selectDistrict)
      map.on('mouseleave', 'banda-aceh-fill', clearDistrict)
      map.on('click', 'banda-aceh-fill', (event) => {
        if (!map) return
        map.easeTo({ center: event.lngLat, zoom: Math.max(map.getZoom(), 12.5) })
      })

      status.value = 'ready'
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'The boundary could not be loaded.'
      status.value = 'error'
    }
  })

  map.once('error', (event) => {
    if (status.value !== 'loading') return
    errorMessage.value = event.error?.message ?? 'The basemap could not be loaded.'
    status.value = 'error'
  })
})

onBeforeUnmount(() => {
  map?.remove()
  map = null
})
</script>

<template>
  <section class="map-panel" aria-labelledby="map-title">
    <div class="map-panel__toolbar">
      <div>
        <p class="eyebrow">Validated v1 geographic asset</p>
        <h3 id="map-title">Banda Aceh administrative boundary</h3>
      </div>
      <span class="data-badge">{{ featureCount || '—' }} features</span>
    </div>

    <div class="map-frame">
      <div
        ref="mapContainer"
        class="map-canvas"
        role="region"
        aria-label="Interactive map of Banda Aceh administrative districts"
        aria-describedby="map-help"
      ></div>

      <div v-if="status === 'loading'" class="map-state" role="status">
        <span class="spinner" aria-hidden="true"></span>
        <strong>Loading geographic data…</strong>
        <small>Connecting to the configured basemap and local boundary.</small>
      </div>

      <div v-else-if="status === 'error'" class="map-state map-state--error" role="alert">
        <strong>Map unavailable</strong>
        <small>{{ errorMessage }}</small>
      </div>

      <aside v-if="selectedDistrict" class="map-inspector" aria-live="polite">
        <p>Selected district</p>
        <strong>{{ selectedDistrict.name }}</strong>
        <span>Recorded area: {{ selectedDistrict.area }}</span>
      </aside>
    </div>

    <p id="map-help" class="map-help">
      Hover over a district to inspect its name and recorded area. Select a district to focus the map.
    </p>
  </section>
</template>
