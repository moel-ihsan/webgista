<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as maplibregl from 'maplibre-gl'
import { GPUInitializationError, setWorkerUrl, type ErrorEvent as MapErrorEvent, type Map as MapLibreMap, type MapLayerMouseEvent } from 'maplibre-gl'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'

import { appConfig, defaultMapStyleId, mapStyles, type MapStyleId } from '../../config/app'
import { authSession } from '../../auth/session'
import { createSupabaseCctvDataSource } from '../../data/supabaseCctvDataSource'
import { DEFAULT_MAP_VIEWPORT, loadMapViewport, type MapViewport } from '../../data/mapSettings'
import type { CctvLocation } from '../../domain/cctv'
import { supabaseClient } from '../../lib/supabase'
import { attachBoundaryLayers, setBoundaryVisibility } from '../../map/boundaryLayers'
import { attachCctvLayers, setCctvVisibility, updateCctvSource } from '../../map/cctvLayers'
import { createCctvPopupContent, focusCctvLocation, mountPopupDemoVideo, searchCctvLocations, toCctvFeatureCollection } from '../../map/cctv'
import { getCctvDemoAssociation } from '../../data/cctvDemoVideo'
import { districtDetails, loadBoundary } from '../../map/boundary'
import { applyMapStyle, cleanupMap, listenForMapReadiness, mapFailure, mapLoadTimeout, type MapFailure } from '../../map/maplibre'
import AppIcon from '../ui/AppIcon.vue'

setWorkerUrl(maplibreWorkerUrl)

let nextMapInstanceId = 0
const props = withDefaults(defineProps<{
  compact?: boolean
  locationPicker?: boolean
  locationCoordinates?: [number, number] | null
  mapCenterPicker?: boolean
  viewport?: MapViewport | null
}>(), { compact: false, locationPicker: false, locationCoordinates: null, mapCenterPicker: false, viewport: null })
const emit = defineEmits<{
  locationSelected: [coordinates: [number, number]]
  viewportChanged: [viewport: MapViewport]
}>()
const mapLoadTimeoutMs = 15_000

type MapStatus = 'loading' | 'ready' | 'error'
type DiagnosticMapEvent = 'load' | 'style.load' | 'idle' | 'render'

const mapContainer = ref<HTMLElement | null>(null)
const status = ref<MapStatus>('loading')
const failure = ref<MapFailure | null>(null)
const resourceNotice = ref('')
const boundaryNotice = ref('')
const featureCount = ref(0)
const hoveredDistrict = ref<{ name: string; area: string } | null>(null)
const selectedDistrict = ref<{ name: string; area: string } | null>(null)
const activeDistrict = computed(() => hoveredDistrict.value ?? selectedDistrict.value)
const layersOpen = ref(false)
const searchOpen = ref(false)
const boundaryVisible = ref(false)
const isPicker = computed(() => props.locationPicker || props.mapCenterPicker)
const cctvVisible = ref(!isPicker.value)
const cctvLocations = ref<readonly CctvLocation[]>([])
const cctvQuery = ref('')
const cctvStatus = ref<'loading' | 'ready' | 'empty' | 'error'>('loading')
const cctvNotice = ref('')
const cctvLayerNotice = ref('')
const filteredCctvLocations = computed(() => searchCctvLocations(cctvLocations.value, cctvQuery.value))
const selectedStyleId = ref<MapStyleId>(defaultMapStyleId)
const boundaryStatus = ref<'loading' | 'ready' | 'error'>('loading')
const mapInstanceId = ++nextMapInstanceId
const mapDiagnosticsEnabled = import.meta.env.DEV && new URLSearchParams(window.location.search).has('map-debug')
const requestedCctvId = new URLSearchParams(window.location.search).get('cctv')

let map: MapLibreMap | null = null
let detachBoundary: (() => void) | null = null
let detachCctv: (() => void) | null = null
let styleReadyHandler: (() => void) | null = null
let detachReadiness: (() => void) | null = null
let mapErrorHandler: ((event: MapErrorEvent) => void) | null = null
let loadTimer: ReturnType<typeof setTimeout> | null = null
let boundaryTimer: ReturnType<typeof setTimeout> | null = null
let boundaryController: AbortController | null = null
let cctvController: AbortController | null = null
let cctvPopup: maplibregl.Popup | null = null
let cctvPopupLocationId: string | null = null
let disposePopupVideo: (() => void) | null = null
let locationMarker: maplibregl.Marker | null = null
let locationClickHandler: ((event: maplibregl.MapMouseEvent) => void) | null = null
let viewportChangeHandler: (() => void) | null = null
let lastMapError = ''
let diagnosticHandlers: Array<{ event: DiagnosticMapEvent; handler: () => void }> = []
let mapSettingsController: AbortController | null = null
let componentUnmounted = false
let homeViewport: MapViewport = { ...DEFAULT_MAP_VIEWPORT }
let requestedCameraFocused = false

function recordMapLifecycle(event: string, details: Record<string, unknown> = {}): void {
  if (!mapDiagnosticsEnabled) return
  const canvas = map?.getCanvas()
  console.info('[WebGISTA map lifecycle]', {
    instance: mapInstanceId,
    event,
    status: status.value,
    styleLoaded: map?.isStyleLoaded() ?? false,
    canvas: canvas ? `${canvas.width}x${canvas.height}` : null,
    ...details,
  })
}

function attachMapDiagnostics(activeMap: MapLibreMap): void {
  if (!mapDiagnosticsEnabled) return
  for (const event of ['load', 'style.load', 'idle'] as const) {
    const handler = () => recordMapLifecycle(event)
    activeMap.on(event, handler)
    diagnosticHandlers.push({ event, handler })
  }
  const renderHandler = () => {
    recordMapLifecycle('first-render')
    activeMap.off('render', renderHandler)
    diagnosticHandlers = diagnosticHandlers.filter(({ handler }) => handler !== renderHandler)
  }
  activeMap.on('render', renderHandler)
  diagnosticHandlers.push({ event: 'render', handler: renderHandler })
}

function showFailure(mapError: MapFailure): void {
  failure.value = mapError
  status.value = 'error'
  recordMapLifecycle('failure', { type: mapError.type })
}

function clearLoadTimer(): void {
  if (loadTimer) clearTimeout(loadTimer)
  loadTimer = null
}

function disposeMapInstance(): void {
  clearLoadTimer()
  if (boundaryTimer) clearTimeout(boundaryTimer)
  boundaryTimer = null
  boundaryController?.abort()
  boundaryController = null
  cctvController?.abort()
  cctvController = null
  closeCctvPopup()
  if (map && mapErrorHandler) map.off('error', mapErrorHandler)
  for (const { event, handler } of diagnosticHandlers) map?.off(event, handler)
  diagnosticHandlers = []
  detachReadiness?.()
  if (map && locationClickHandler) map.off('click', locationClickHandler)
  if (map && viewportChangeHandler) map.off('moveend', viewportChangeHandler)
  locationMarker?.remove()
  locationMarker = null
  cleanupMap(map, () => {
    detachBoundary?.()
    detachCctv?.()
  })
  map = null
  detachBoundary = null
  detachCctv = null
  mapErrorHandler = null
  styleReadyHandler = null
  locationClickHandler = null
  viewportChangeHandler = null
  detachReadiness = null
}

function failMapInitialization(error: unknown): void {
  showFailure(mapFailure(error instanceof Error ? error.message : ''))
  disposeMapInstance()
}

function waitForStyle(): void {
  clearLoadTimer()
  lastMapError = ''
  status.value = 'loading'
  failure.value = null
  recordMapLifecycle('waiting-for-style')
  loadTimer = setTimeout(() => {
    if (status.value !== 'loading') return
    showFailure(lastMapError ? mapFailure(lastMapError) : mapLoadTimeout())
  }, mapLoadTimeoutMs)
}

function reportMapError(event: MapErrorEvent): void {
  const message = event.error.message
  const mapError = mapFailure(message)

  if (event.error instanceof GPUInitializationError) {
    showFailure(mapFailure('WebGL2 GPU initialization failed'))
    clearLoadTimer()
    return
  }
  if (mapError.type === 'webgl') {
    showFailure(mapError)
    clearLoadTimer()
    return
  }

  if (status.value === 'loading') {
    lastMapError = message
    return
  }

  resourceNotice.value = `${mapError.title}. ${mapError.message}`
}

function districtFromEvent(event: MapLayerMouseEvent): { name: string; area: string } | null {
  return districtDetails(event.features?.[0]?.properties)
}

function hoverDistrict(event: MapLayerMouseEvent): void {
  const district = districtFromEvent(event)
  if (!district) {
    clearDistrict()
    return
  }
  hoveredDistrict.value = district
  if (map) map.getCanvas().style.cursor = 'pointer'
}

function clearDistrict(): void {
  hoveredDistrict.value = null
  if (map) map.getCanvas().style.cursor = ''
}

function selectDistrict(event: MapLayerMouseEvent): void {
  const district = districtFromEvent(event)
  if (!district || !map) return
  selectedDistrict.value = district
  map.easeTo({ center: event.lngLat, zoom: Math.max(map.getZoom(), 12.5) })
}

function goHome(): void {
  map?.flyTo({ center: [homeViewport.longitude, homeViewport.latitude], zoom: homeViewport.zoom, essential: true })
}

function showCctvPopup(location: CctvLocation): void {
  if (!map) return
  closeCctvPopup()
  const content = createCctvPopupContent(location)

  const popup = new maplibregl.Popup({ closeOnClick: true, offset: 10 })
    .setLngLat([location.longitude, location.latitude])
    .setDOMContent(content)
    .addTo(map)
  cctvPopup = popup
  cctvPopupLocationId = location.id
  popup.on('close', () => {
    if (cctvPopup === popup) {
      disposePopupVideo?.()
      disposePopupVideo = null
      cctvPopup = null
      cctvPopupLocationId = null
    }
  })
  if (authSession.state.status === 'authenticated' && supabaseClient) {
    void getCctvDemoAssociation(supabaseClient, location.id).then(({ video }) => {
      if (video && cctvPopup === popup && cctvPopupLocationId === location.id) {
        disposePopupVideo = mountPopupDemoVideo(content, location, video)
      }
    }).catch(() => { /* RLS-hidden video falls back to the authorized image. */ })
  }
}

function closeCctvPopup(): void {
  cctvPopup?.remove()
  disposePopupVideo?.()
  disposePopupVideo = null
  cctvPopup = null
  cctvPopupLocationId = null
}

function selectCctvLocation(id: string): void {
  const location = cctvLocations.value.find((camera) => camera.id === id)
  if (!map || !location) return
  focusCctvLocation(map, location, searchOpen.value, showCctvPopup)
}

function selectSearchResult(location: CctvLocation): void {
  if (!map) return
  focusCctvLocation(map, location, searchOpen.value, showCctvPopup)
}

async function loadCctvLocations(): Promise<void> {
  if (!supabaseClient) {
    cctvStatus.value = 'error'
    cctvNotice.value = 'Supabase is not configured. CCTV locations are unavailable.'
    return
  }

  const controller = new AbortController()
  cctvController = controller
  cctvStatus.value = 'loading'
  cctvNotice.value = ''

  try {
    const locations = await createSupabaseCctvDataSource(supabaseClient).listLocations(controller.signal)
    if (controller.signal.aborted) return
    cctvLocations.value = locations
    if (cctvPopupLocationId && !locations.some(({ id }) => id === cctvPopupLocationId)) closeCctvPopup()
    cctvStatus.value = locations.length ? 'ready' : 'empty'
    if (map) updateCctvSource(map, toCctvFeatureCollection(locations))
  } catch {
    if (controller.signal.aborted) return
    cctvLocations.value = []
    closeCctvPopup()
    cctvStatus.value = 'error'
    cctvNotice.value = 'CCTV locations could not load. Check the connection and data permissions.'
    if (map) updateCctvSource(map, toCctvFeatureCollection([]))
  } finally {
    if (cctvController === controller) cctvController = null
  }
}

watch(() => authSession.state.status, (authStatus) => {
  if (isPicker.value) {
    cctvLocations.value = []
    cctvStatus.value = 'empty'
    return
  }
  cctvController?.abort()
  cctvController = null
  if (authStatus === 'loading') {
    cctvLocations.value = []
    cctvStatus.value = 'loading'
    cctvNotice.value = ''
    closeCctvPopup()
    if (map) updateCctvSource(map, toCctvFeatureCollection([]))
    return
  }
  void loadCctvLocations()
}, { immediate: true })

function selectMapStyle(): void {
  if (map) {
    closeCctvPopup()
    waitForStyle()
    applyMapStyle(map, selectedStyleId.value)
  }
}

watch(boundaryVisible, (visible) => {
  if (map) setBoundaryVisibility(map, visible)
})

watch(cctvVisible, (visible) => {
  if (map) setCctvVisibility(map, visible)
})

function isValidCoordinatePair(coordinates: unknown): coordinates is [number, number] {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) return false
  const [longitude, latitude] = coordinates
  return typeof longitude === 'number'
    && typeof latitude === 'number'
    && Number.isFinite(longitude)
    && Number.isFinite(latitude)
    && longitude >= -180
    && longitude <= 180
    && latitude >= -90
    && latitude <= 90
}

function setLocationMarker(coordinates: [number, number] | null): boolean {
  if (!map || !isPicker.value) return false
  if (!isValidCoordinatePair(coordinates)) {
    locationMarker?.remove()
    locationMarker = null
    return false
  }
  try {
    if (!locationMarker) {
      const marker = new maplibregl.Marker({ color: '#e65f62' })
      try {
        marker.setLngLat(coordinates)
        locationMarker = marker.addTo(map)
      } catch (error) {
        marker.remove()
        throw error
      }
    } else {
      locationMarker.setLngLat(coordinates)
    }
    return true
  } catch (error) {
    locationMarker?.remove()
    locationMarker = null
    failMapInitialization(error)
    return false
  }
}

watch(() => props.locationCoordinates, (coordinates) => {
  if (!props.locationPicker) return
  setLocationMarker(coordinates)
  if (map && isValidCoordinatePair(coordinates)) map.easeTo({ center: coordinates, zoom: Math.max(map.getZoom(), 12) })
}, { deep: true })

watch(() => props.viewport, (viewport) => {
  if (!map || !props.mapCenterPicker || !viewport) return
  const validation = isValidCoordinatePair([viewport.longitude, viewport.latitude])
  if (!validation || !Number.isFinite(viewport.zoom) || viewport.zoom < 8 || viewport.zoom > 18) {
    locationMarker?.remove()
    locationMarker = null
    return
  }
  const center: [number, number] = [viewport.longitude, viewport.latitude]
  setLocationMarker(center)
  const current = map.getCenter()
  if (Math.abs(current.lng - center[0]) > 0.000001 || Math.abs(current.lat - center[1]) > 0.000001 || Math.abs(map.getZoom() - viewport.zoom) > 0.001) {
    map.jumpTo({ center, zoom: viewport.zoom })
  }
}, { deep: true })

async function initializeMap(): Promise<void> {
  recordMapLifecycle('mounted')
  if (!mapContainer.value) return

  let initialViewport: MapViewport = { ...DEFAULT_MAP_VIEWPORT }
  if (props.mapCenterPicker && props.viewport) initialViewport = props.viewport
  else if (!isPicker.value && supabaseClient) {
    const controller = new AbortController()
    mapSettingsController = controller
    const settingsTimeout = setTimeout(() => controller.abort(), 5000)
    try {
      initialViewport = await loadMapViewport(supabaseClient, controller.signal) ?? initialViewport
    } catch {
      initialViewport = { ...DEFAULT_MAP_VIEWPORT }
    } finally {
      clearTimeout(settingsTimeout)
      if (mapSettingsController === controller) mapSettingsController = null
    }
  }
  if (componentUnmounted || !mapContainer.value) return
  homeViewport = { ...initialViewport }

  try {
    const initialCoordinates = props.locationPicker && isValidCoordinatePair(props.locationCoordinates)
      ? props.locationCoordinates
      : null
    const viewportCenter: [number, number] = [initialViewport.longitude, initialViewport.latitude]
    map = new maplibregl.Map({
      container: mapContainer.value,
      style: mapStyles.find((item) => item.id === selectedStyleId.value)?.url,
      center: initialCoordinates ?? viewportCenter,
      zoom: initialCoordinates ? Math.max(initialViewport.zoom, 12) : initialViewport.zoom,
      bearing: 0,
      pitch: 0,
      minZoom: 8,
      maxZoom: 18,
      attributionControl: false,
    })

    recordMapLifecycle('constructor-complete')
    waitForStyle()
    mapErrorHandler = reportMapError
    map.on('error', mapErrorHandler)
    attachMapDiagnostics(map)
    styleReadyHandler = () => {
      recordMapLifecycle('ready-callback')
      if (status.value !== 'loading') return
      clearLoadTimer()
      status.value = 'ready'
      failure.value = null
      resourceNotice.value = ''
    }
    detachReadiness = listenForMapReadiness(map, styleReadyHandler)
    recordMapLifecycle('readiness-evaluated')

    map.addControl(new maplibregl.AttributionControl(), 'top-right')
    if (!props.compact) {
      map.addControl(new maplibregl.NavigationControl(), 'top-left')
      map.addControl(
        new maplibregl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
        }),
        'top-left',
      )
      map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right')
    }
  } catch (error) {
    failMapInitialization(error instanceof GPUInitializationError ? new Error('WebGL2 GPU initialization failed') : error)
    return
  }

  const activeMap = map
  locationClickHandler = (event) => {
    if (!isPicker.value) return
    const coordinates: [number, number] = [event.lngLat.lng, event.lngLat.lat]
    if (!isValidCoordinatePair(coordinates) || !setLocationMarker(coordinates)) return
    if (props.locationPicker) emit('locationSelected', coordinates)
    if (props.mapCenterPicker) {
      map?.easeTo({ center: coordinates })
      emit('viewportChanged', { latitude: coordinates[1], longitude: coordinates[0], zoom: map?.getZoom() ?? homeViewport.zoom })
    }
  }
  map.on('click', locationClickHandler)
  if (props.locationPicker) setLocationMarker(props.locationCoordinates)
  if (props.mapCenterPicker) {
    setLocationMarker([initialViewport.longitude, initialViewport.latitude])
    viewportChangeHandler = () => {
      if (!map) return
      const center = map.getCenter()
      emit('viewportChanged', { latitude: center.lat, longitude: center.lng, zoom: map.getZoom() })
    }
    map.on('moveend', viewportChangeHandler)
  }
  if (!map) return
  if (!isPicker.value) {
    detachCctv = attachCctvLayers(
      activeMap,
      () => toCctvFeatureCollection(cctvLocations.value),
      () => cctvVisible.value,
      props.compact,
      selectCctvLocation,
      {
        ready: () => { cctvLayerNotice.value = '' },
        error: () => { cctvLayerNotice.value = 'CCTV markers could not be displayed. The basemap remains available.' },
      },
    )
  }
  if (props.mapCenterPicker) return

  boundaryController = new AbortController()
  boundaryTimer = setTimeout(() => boundaryController?.abort(), mapLoadTimeoutMs)
  void loadBoundary(appConfig.map.boundaryUrl, boundaryController.signal)
    .then((boundary) => {
      if (!map) return
      detachBoundary = attachBoundaryLayers(
        activeMap,
        boundary,
        () => boundaryVisible.value,
        {
          move: hoverDistrict,
          leave: clearDistrict,
          click: selectDistrict,
        },
        () => {
          boundaryStatus.value = 'ready'
          boundaryNotice.value = ''
          featureCount.value = boundary.features.length
        },
        () => {
          boundaryStatus.value = 'error'
          boundaryNotice.value = 'Banda Aceh district boundaries could not be added. The basemap remains available.'
          featureCount.value = 0
        },
      )
    })
    .catch(() => {
      if (!map) return
      boundaryStatus.value = 'error'
      boundaryNotice.value = 'Banda Aceh district boundaries could not load. The basemap remains available.'
      featureCount.value = 0
    })
    .finally(() => {
      if (boundaryTimer) clearTimeout(boundaryTimer)
      boundaryTimer = null
      boundaryController = null
    })
}

onMounted(() => { void initializeMap() })

onBeforeUnmount(() => {
  componentUnmounted = true
  mapSettingsController?.abort()
  mapSettingsController = null
  recordMapLifecycle('unmount')
  disposeMapInstance()
})

watch(status, (next, previous) => recordMapLifecycle('status-change', { from: previous, to: next }))
watch(failure, (value) => recordMapLifecycle('error-state-change', { type: value?.type ?? null }))
watch([status, cctvLocations], ([mapStatus, locations]) => {
  if (props.compact || mapStatus !== 'ready' || requestedCameraFocused || !requestedCctvId) return
  if (locations.some(({ id }) => id === requestedCctvId)) {
    requestedCameraFocused = true
    selectCctvLocation(requestedCctvId)
  }
})
</script>

<template>
  <section class="map-panel" :class="{ 'map-panel--compact': compact }" :aria-label="isPicker ? 'Select a map location in Banda Aceh' : 'Banda Aceh map'">
    <div class="map-frame" :class="{ 'map-frame--compact': compact }">
      <div
        ref="mapContainer"
        class="map-canvas"
        role="region"
        aria-label="Interactive map of Banda Aceh administrative districts"
      ></div>

      <div v-if="!compact" class="map-actions">
        <button class="map-action map-action--home" type="button" aria-label="Return to map home" title="Home" @click="goHome">
          <AppIcon name="homepin" />
        </button>
        <button
          class="map-action map-action--layers"
          type="button"
          aria-label="Map layers"
          :aria-expanded="layersOpen"
          title="Map layers"
          @click="layersOpen = !layersOpen"
        >
          <AppIcon name="layers" />
        </button>
      </div>

      <button
        v-if="!compact && !searchOpen"
        class="map-action map-action--search"
        type="button"
        aria-label="CCTV search"
        aria-expanded="false"
        title="CCTV search"
        @click="searchOpen = !searchOpen"
      >
        <AppIcon name="search" />
      </button>

      <aside v-if="layersOpen && !compact" class="map-layer-panel" aria-label="Map layer controls">
        <fieldset class="map-style-options">
          <legend class="map-panel-label">Map Style</legend>
          <label v-for="style in appConfig.map.styles" :key="style.id" class="map-style-option">
            <input v-model="selectedStyleId" type="radio" name="map-style" :value="style.id" @change="selectMapStyle" />
            <span>{{ style.label }}</span>
          </label>
        </fieldset>
        <p class="map-panel-label">Layer</p>
        <label class="map-layer-option">
          <input v-model="boundaryVisible" type="checkbox" :disabled="boundaryStatus === 'error'" />
          <span>Banda Aceh ADM ({{ featureCount }} areas)</span>
        </label>
        <label class="map-layer-option">
          <input v-model="cctvVisible" type="checkbox" />
          <span>CCTV ({{ cctvStatus === 'loading' ? 'loading…' : cctvLocations.length }})</span>
        </label>
        <p v-if="cctvNotice" class="map-data-note" role="status">{{ cctvNotice }}</p>
      </aside>

      <aside v-if="searchOpen && !compact" class="map-search-panel" aria-label="Search CCTV locations">
        <div class="map-search-panel__heading">
          <h2>CCTV Locations</h2>
          <button class="map-action" type="button" aria-label="Close CCTV search" @click="searchOpen = false">
            <AppIcon name="close" :size="17" />
          </button>
        </div>
        <input v-model="cctvQuery" type="search" placeholder="Please input" aria-label="Search CCTV locations" />
        <p v-if="cctvStatus === 'loading'" role="status">Loading CCTV locations…</p>
        <p v-else-if="cctvStatus === 'error'" role="alert">{{ cctvNotice }}</p>
        <p v-else-if="cctvStatus === 'empty'">No public or agency-authorized CCTV locations are available.</p>
        <div v-else class="map-search-results">
          <button
            v-for="location in filteredCctvLocations"
            :key="location.id"
            class="map-search-result"
            type="button"
            @click="selectSearchResult(location)"
          >
            <span class="map-search-result__content">
              <strong>{{ location.name }}</strong>
              <span class="map-search-result__coordinates">
                {{ location.longitude.toFixed(6) }} E {{ location.latitude.toFixed(6) }} N
              </span>
              <span class="map-search-result__address">{{ location.address || 'Address not recorded' }}</span>
              <span class="map-search-result__category">{{ location.category === 'regular' ? 'Regular' : 'Analytic' }}</span>
              <span class="map-search-result__condition"><i aria-hidden="true"></i>No Data</span>
            </span>
            <span class="map-search-result__thumbnail" aria-hidden="true">
              <img v-if="location.snapshotUrl" :src="location.snapshotUrl" alt="" loading="lazy">
              <span v-else>WebGIS</span>
            </span>
          </button>
          <p v-if="filteredCctvLocations.length === 0" class="map-search-results__empty">No Data</p>
        </div>
      </aside>

      <div v-if="!compact && !searchOpen" class="legacy-traffic-legend" aria-label="Traffic condition legend">
        <h2>Traffic Condition</h2>
        <div><span style="--legend-color: #ff0000"></span>Terrible</div>
        <div><span style="--legend-color: #ff5f00"></span>Bad</div>
        <div><span style="--legend-color: #d4a328"></span>Poor</div>
        <div><span style="--legend-color: #ffff00"></span>Average</div>
        <div><span style="--legend-color: #0b6623"></span>Good</div>
        <div><span style="--legend-color: #98fb98"></span>Great</div>
        <div><span style="--legend-color: #0000ff"></span>No Data</div>
        <p>Marker colors use the latest authorized observation; cameras without one show No Data.</p>
      </div>

      <div v-if="status === 'loading'" class="map-state" role="status">
        <span class="spinner" aria-hidden="true"></span>
        <strong>Loading map…</strong>
      </div>

      <div v-else-if="status === 'error'" class="map-state map-state--error" role="alert">
        <strong>{{ failure?.title ?? 'Map unavailable' }}</strong>
        <small>{{ failure?.message }}</small>
      </div>

      <p v-if="resourceNotice && status === 'ready'" class="map-runtime-notice" role="status">{{ resourceNotice }}</p>
      <p v-if="boundaryNotice && status === 'ready'" class="map-runtime-notice" role="status">{{ boundaryNotice }}</p>
      <p v-if="cctvLayerNotice && status === 'ready'" class="map-runtime-notice map-runtime-notice--cctv" role="status">{{ cctvLayerNotice }}</p>
      <p v-if="compact && !isPicker && cctvStatus === 'loading'" class="map-compact-notice" role="status">Loading CCTV locations…</p>
      <p v-else-if="compact && !isPicker && cctvStatus === 'empty'" class="map-compact-notice" role="status">No authorized CCTV locations are available.</p>
      <p v-else-if="compact && !isPicker && cctvStatus === 'error'" class="map-compact-notice" role="alert">{{ cctvNotice }}</p>

      <aside v-if="activeDistrict && !compact" class="map-inspector" aria-live="polite">
        <p>{{ hoveredDistrict ? 'District' : 'Selected district' }}</p>
        <strong>{{ activeDistrict.name }}</strong>
        <span>Recorded area: {{ activeDistrict.area }}</span>
      </aside>
    </div>
  </section>
</template>
