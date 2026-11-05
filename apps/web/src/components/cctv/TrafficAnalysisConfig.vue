<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'

import { authSession } from '../../auth/session'
import { supabaseClient } from '../../lib/supabase'
import { getCctvAnalysisConfig, saveCctvAnalysisConfig } from '../../data/cctvAnalysisConfig'
import type { TrafficDemoVideo } from '../../data/trafficDemo'
import { rectangleToPolygon, validateRoiDensityConfig, validateRoiPolygon, type RoiDensityConfig, type RoiPoint } from '../../domain/roiDensity'

const props = defineProps<{ cameraId: string; video: TrafficDemoVideo | null; editable: boolean }>()
const loading = ref(false)
const saving = ref(false)
const savedVersion = ref<number | null>(null)
const error = ref('')
const status = ref('')
const videoReady = ref(false)
const mode = ref<'view' | 'rectangle' | 'polygon' | 'edit'>('view')
const selectedVertex = ref<number | null>(null)
const points = ref<RoiPoint[]>([])
const rect = ref<[number, number, number, number]>([0.55, 0.48, 0.44, 0.43])
const drawingStart = ref<RoiPoint | null>(null)
const editStart = ref<RoiPoint | null>(null)
const editPointsStart = ref<RoiPoint[]>([])
const rectHandle = ref<number | null>(null)
const resizeStartRect = ref<[number, number, number, number] | null>(null)
const windowInput = ref('10')
const refreshInput = ref('10')
const samplingInput = ref('5')
const coverageInput = ref('0.8')
const includedClasses = ref(['car', 'bus', 'truck', 'motorcycle', 'bicycle'])
const busyThresholdInput = ref('0')
const thresholdInputs = ref(['', '', '', '', ''])
const form = reactive({
  roiType: 'rectangle' as 'rectangle' | 'polygon',
  confidence: '0.35',
  calibrationStatus: 'uncalibrated' as 'uncalibrated' | 'experimental' | 'calibrated',
  calibrationNote: '',
})

const dimensions = computed(() => props.video?.analysis.video_dimensions ?? { width: 1280, height: 720 })
const videoUrl = computed(() => props.video?.previewVideoUrl ?? '')
const normalizedPoints = computed<RoiPoint[]>(() => {
  if (form.roiType !== 'rectangle') return points.value
  try { return rectangleToPolygon(rect.value) } catch { return [] }
})
const thresholdValues = computed<number[] | null>(() => {
  if (thresholdInputs.value.every((value) => value.trim() === '')) return null
  if (thresholdInputs.value.some((value) => value.trim() === '')) return []
  return thresholdInputs.value.map(Number)
})
const thresholdPreview = computed(() => {
  const values = thresholdValues.value
  if (!values || values.length !== 5 || values.some((value, index) => !Number.isFinite(value) || value < 0 || (index > 0 && value <= values[index - 1]!))) return []
  const labels = ['Great', 'Good', 'Average', 'Poor', 'Bad', 'Terrible']
  return labels.map((label, index) => ({
    label,
    range: index === 0 ? `< ${values[0]}` : index === labels.length - 1 ? `≥ ${values[index - 1]}` : `${values[index - 1]} to < ${values[index]}`,
  }))
})
const config = computed<RoiDensityConfig>(() => ({
  schema_version: 'webgista.roi-density-config.v1',
  roi_type: form.roiType,
  roi_geometry: form.roiType === 'rectangle' ? [...rect.value] as [number, number, number, number] : points.value.map(([x, y]) => [x, y] as RoiPoint),
  video_dimensions: { ...dimensions.value },
  observation_window_seconds: Number(windowInput.value),
  refresh_seconds: Number(refreshInput.value),
  sampled_fps: Number(samplingInput.value),
  minimum_detection_confidence: Number(form.confidence),
  included_classes: [...includedClasses.value],
  busy_threshold_vehicles: Number(busyThresholdInput.value),
  minimum_valid_coverage: Number(coverageInput.value),
  density_thresholds: thresholdValues.value,
  calibration_status: form.calibrationStatus,
  calibration_note: form.calibrationNote,
}))

function defaults(): RoiDensityConfig {
  const source = props.video?.analysis.processing_config.roi_normalized
  return {
    schema_version: 'webgista.roi-density-config.v1',
    roi_type: 'rectangle',
    roi_geometry: source ? [...source] as [number, number, number, number] : [0.55, 0.48, 0.44, 0.43],
    video_dimensions: { ...dimensions.value },
    observation_window_seconds: 10, refresh_seconds: 10, sampled_fps: 5,
    minimum_detection_confidence: 0.35, included_classes: ['car', 'bus', 'truck', 'motorcycle', 'bicycle'],
    busy_threshold_vehicles: 0, minimum_valid_coverage: 0.8,
    density_thresholds: null, calibration_status: 'uncalibrated', calibration_note: '',
  }
}

function applyConfig(value: RoiDensityConfig): void {
  form.roiType = value.roi_type
  if (value.roi_type === 'rectangle') rect.value = [...value.roi_geometry] as [number, number, number, number]
  else points.value = (value.roi_geometry as RoiPoint[]).map(([x, y]) => [x, y])
  form.confidence = String(value.minimum_detection_confidence)
  windowInput.value = String(value.observation_window_seconds)
  refreshInput.value = String(value.refresh_seconds)
  samplingInput.value = String(value.sampled_fps)
  coverageInput.value = String(value.minimum_valid_coverage)
  includedClasses.value = [...value.included_classes]
  busyThresholdInput.value = String(value.busy_threshold_vehicles)
  thresholdInputs.value = value.density_thresholds?.map(String) ?? ['', '', '', '', '']
  form.calibrationStatus = value.calibration_status
  form.calibrationNote = value.calibration_note ?? ''
}

async function load(): Promise<void> {
  if (!supabaseClient || !props.editable) return
  loading.value = true
  error.value = ''
  try {
    const stored = await getCctvAnalysisConfig(supabaseClient, props.cameraId)
    applyConfig(stored?.configuration ?? defaults())
    savedVersion.value = stored?.configurationVersion ?? null
    status.value = stored ? `Saved configuration v${stored.configurationVersion} · ${new Date(stored.updatedAt).toLocaleString()}` : 'No ROI configuration is saved yet.'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'ROI configuration could not be loaded.'
  } finally {
    loading.value = false
  }
}

onMounted(() => { void load() })
watch(() => [props.cameraId, props.video?.id, props.editable] as const, () => { void load() })

function localPoint(event: PointerEvent): RoiPoint {
  const target = event.currentTarget as SVGElement
  const svg = target instanceof SVGSVGElement ? target : target.ownerSVGElement
  const rectBounds = svg!.getBoundingClientRect()
  if (!rectBounds.width || !rectBounds.height) return [0, 0]
  return [Math.min(1, Math.max(0, (event.clientX - rectBounds.left) / rectBounds.width)), Math.min(1, Math.max(0, (event.clientY - rectBounds.top) / rectBounds.height))]
}

function beginRectangleMove(event: PointerEvent): void {
  if (mode.value === 'rectangle') {
    drawingStart.value = localPoint(event)
    rect.value = [drawingStart.value[0], drawingStart.value[1], 0, 0]
    ;(event.currentTarget as SVGElement).ownerSVGElement?.setPointerCapture(event.pointerId)
    return
  }
  if (mode.value !== 'edit') return
  editStart.value = localPoint(event)
  editPointsStart.value = rect.value.map((value) => [value, value]) as RoiPoint[]
  ;(event.currentTarget as SVGElement).ownerSVGElement?.setPointerCapture(event.pointerId)
}

function beginRectangleResize(event: PointerEvent, index: number): void {
  rectHandle.value = index
  resizeStartRect.value = [...rect.value]
  ;(event.currentTarget as SVGElement).ownerSVGElement?.setPointerCapture(event.pointerId)
}

function beginPolygonVertexMove(event: PointerEvent, index: number): void {
  selectedVertex.value = index
  editStart.value = localPoint(event)
  editPointsStart.value = points.value.map(([x, y]) => [x, y])
  ;(event.currentTarget as SVGElement).ownerSVGElement?.setPointerCapture(event.pointerId)
}

function finishRectangle(point: RoiPoint): void {
  if (!drawingStart.value) return
  const [x1, y1] = drawingStart.value
  const x = Math.min(x1, point[0])
  const y = Math.min(y1, point[1])
  const width = Math.abs(point[0] - x1)
  const height = Math.abs(point[1] - y1)
  if (width > 0.01 && height > 0.01) rect.value = [x, y, width, height]
  drawingStart.value = null
  mode.value = 'edit'
}

function onCanvasDown(event: PointerEvent): void {
  if (mode.value === 'rectangle') {
    drawingStart.value = localPoint(event)
    rect.value = [drawingStart.value[0], drawingStart.value[1], 0, 0]
    ;(event.currentTarget as SVGSVGElement).setPointerCapture(event.pointerId)
    return
  }
  if (mode.value === 'polygon') {
    points.value = [...points.value, localPoint(event)]
    return
  }
  if (mode.value === 'edit' && form.roiType === 'polygon') {
    editStart.value = localPoint(event)
    editPointsStart.value = points.value.map(([x, y]) => [x, y])
    ;(event.currentTarget as SVGSVGElement).setPointerCapture(event.pointerId)
  }
}

function onCanvasMove(event: PointerEvent): void {
  const point = localPoint(event)
  if (drawingStart.value) {
    const [x, y] = drawingStart.value
    rect.value = [Math.min(x, point[0]), Math.min(y, point[1]), Math.abs(point[0] - x), Math.abs(point[1] - y)]
    return
  }
  if (rectHandle.value !== null) {
    const [x, y, width, height] = resizeStartRect.value ?? rect.value
    const corners: RoiPoint[] = [[x, y], [x + width, y], [x + width, y + height], [x, y + height]]
    const opposite = corners[(rectHandle.value + 2) % 4]!
    rect.value = [Math.min(opposite[0], point[0]), Math.min(opposite[1], point[1]), Math.abs(point[0] - opposite[0]), Math.abs(point[1] - opposite[1])]
    return
  }
  if (editStart.value && form.roiType === 'rectangle') {
    const dx = point[0] - editStart.value[0]
    const dy = point[1] - editStart.value[1]
    const [x, y, width, height] = rect.value
    rect.value = [Math.min(1 - width, Math.max(0, x + dx)), Math.min(1 - height, Math.max(0, y + dy)), width, height]
    editStart.value = point
    return
  }
  if (editStart.value && form.roiType === 'polygon' && selectedVertex.value !== null) {
    const next = [...editPointsStart.value]
    next[selectedVertex.value] = point
    points.value = next
    return
  }
  if (editStart.value && form.roiType === 'polygon') {
    const dx = point[0] - editStart.value[0]
    const dy = point[1] - editStart.value[1]
    points.value = editPointsStart.value.map(([x, y]) => [Math.min(1, Math.max(0, x + dx)), Math.min(1, Math.max(0, y + dy))])
  }
}

function onCanvasUp(event: PointerEvent): void {
  if (drawingStart.value) finishRectangle(localPoint(event))
  rectHandle.value = null
  resizeStartRect.value = null
  editStart.value = null
}

function startRectangle(): void {
  form.roiType = 'rectangle'
  selectedVertex.value = null
  drawingStart.value = null
  points.value = []
  mode.value = 'rectangle'
}

function startPolygon(): void {
  form.roiType = 'polygon'
  selectedVertex.value = null
  points.value = []
  mode.value = 'polygon'
}

function finishPolygon(): void {
  try {
    points.value = validateRoiPolygon(points.value)
    mode.value = 'edit'
    status.value = 'Polygon completed. Drag a vertex or the area to adjust it.'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Draw a valid polygon.'
  }
}

function removeVertex(): void {
  if (selectedVertex.value === null) return
  points.value.splice(selectedVertex.value, 1)
  selectedVertex.value = null
}

function clearArea(): void {
  points.value = []
  rect.value = [0, 0, 0, 0]
  form.roiType = 'polygon'
  mode.value = 'edit'
  status.value = 'Area cleared. Draw a rectangle or polygon before saving.'
}

function resetArea(): void {
  applyConfig(defaults())
  mode.value = 'view'
  status.value = 'Restored the demo video’s previous ROI as an editable starting point.'
}

function exportConfig(): void {
  const url = URL.createObjectURL(new Blob([`${JSON.stringify({ ...config.value, camera_id: props.cameraId, configuration_version: savedVersion.value ?? 1 }, null, 2)}\n`], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `cctv-${props.cameraId}-roi-density.json`
  link.click()
  URL.revokeObjectURL(url)
}

async function save(): Promise<void> {
  if (!supabaseClient || !props.editable || !authSession.state.user?.id) return
  error.value = ''
  if (!videoReady.value || !props.video) {
    error.value = 'Choose a playable authorized demo video before saving its ROI.'
    return
  }
  if (dimensions.value.width !== props.video.analysis.video_dimensions.width || dimensions.value.height !== props.video.analysis.video_dimensions.height) {
    error.value = 'ROI video dimensions do not match the selected source.'
    return
  }
  if (form.roiType === 'polygon') {
    try { validateRoiPolygon(points.value) } catch (cause) { error.value = cause instanceof Error ? cause.message : 'ROI polygon is invalid.'; return }
  }
  const validation = validateRoiDensityConfig(config.value)
  if (validation) { error.value = validation; return }
  saving.value = true
  try {
    const stored = await saveCctvAnalysisConfig(supabaseClient, props.cameraId, config.value)
    savedVersion.value = stored.configurationVersion
    status.value = `ROI configuration v${stored.configurationVersion} saved. Existing analysis results are stale until reprocessed.`
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'ROI configuration could not be saved.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="roi-config" aria-labelledby="roi-config-heading">
    <h3 id="roi-config-heading">Traffic Analysis Configuration</h3>
    <p class="roi-config__note">ROI Density measures concurrent vehicle presence in the selected video area. It is not vehicles/hour, unique crossings, MKJI V/C, or an official road service level.</p>
    <p v-if="!editable" class="roi-config__note" role="status">Only an authorized administrator or editor for this CCTV’s agency can change analysis settings.</p>
    <p v-if="loading" role="status">Loading ROI configuration…</p>
    <p v-if="error" role="alert" class="roi-config__error">{{ error }}</p>
    <p v-if="status" role="status">{{ status }}</p>
    <p v-if="!video" class="roi-config__note" role="status">Select one of the approved video sources above to preview and configure its analysis area. Private stream URLs are not accepted in the browser.</p>
    <template v-else>
      <div class="roi-config__source">
        <strong>EXPERIMENTAL — DEMO VIDEO</strong>
        <span>{{ video.title }} · {{ dimensions.width }} × {{ dimensions.height }}</span>
      </div>
      <div class="roi-config__stage" :style="{ aspectRatio: `${dimensions.width} / ${dimensions.height}` }">
        <video :src="videoUrl" :poster="video.analysis ? undefined : ''" controls playsinline preload="metadata" @loadedmetadata="videoReady = true" @error="videoReady = false" />
        <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" role="img" aria-label="Normalized detection area overlay" @pointerdown="onCanvasDown" @pointermove="onCanvasMove" @pointerup="onCanvasUp" @pointercancel="onCanvasUp">
          <polygon v-if="normalizedPoints.length >= 3" :points="normalizedPoints.map(([x, y]) => `${x * 1000},${y * 1000}`).join(' ')" class="roi-config__shape" :class="{ 'roi-config__shape--editable': mode === 'edit' }" @pointerdown.stop="form.roiType === 'rectangle' ? beginRectangleMove($event as PointerEvent) : onCanvasDown($event as PointerEvent)" />
          <circle v-for="(point, index) in normalizedPoints" :key="index" :cx="point[0] * 1000" :cy="point[1] * 1000" r="10" class="roi-config__handle" :class="{ 'roi-config__handle--selected': selectedVertex === index }" @pointerdown.stop="form.roiType === 'rectangle' ? beginRectangleResize($event as PointerEvent, index) : beginPolygonVertexMove($event as PointerEvent, index)" />
          <g v-if="drawingStart && mode === 'rectangle'" class="roi-config__draft">
            <rect :x="rect[0] * 1000" :y="rect[1] * 1000" :width="rect[2] * 1000" :height="rect[3] * 1000" />
          </g>
          <polyline v-if="mode === 'polygon' && points.length" :points="points.map(([x, y]) => `${x * 1000},${y * 1000}`).join(' ')" class="roi-config__draft" />
        </svg>
      </div>
      <div class="roi-config__actions">
        <button class="legacy-button legacy-button--outline" type="button" :disabled="!editable || saving" @click="startRectangle">Draw Rectangle</button>
        <button class="legacy-button legacy-button--outline" type="button" :disabled="!editable || saving" @click="startPolygon">Draw Polygon</button>
        <button v-if="mode === 'polygon'" class="legacy-button legacy-button--outline" type="button" @click="finishPolygon">Finish Polygon</button>
        <button v-if="selectedVertex !== null && form.roiType === 'polygon'" class="legacy-button legacy-button--outline" type="button" @click="removeVertex">Delete Vertex</button>
        <button class="legacy-button legacy-button--outline" type="button" :disabled="!editable || saving" @click="mode = 'edit'">Edit Area</button>
        <button class="legacy-button legacy-button--outline" type="button" :disabled="!editable || saving" @click="clearArea">Clear Area</button>
        <button class="legacy-button legacy-button--outline" type="button" :disabled="!editable || saving" @click="resetArea">Reset Area</button>
      </div>
      <p class="roi-config__note">Rectangle: click and drag. Polygon: click vertices, then Finish Polygon. In Edit Area mode, drag the area or its vertices. Coordinates are saved normalized to the source video, not the preview size.</p>
      <div class="roi-config__fields">
        <label>Observation window (seconds)<input v-model="windowInput" class="legacy-input" type="number" min="1" max="300" step="1" :disabled="!editable || saving"></label>
        <label>Window refresh (seconds)<input v-model="refreshInput" class="legacy-input" type="number" min="1" max="300" step="1" :disabled="!editable || saving"></label>
        <label>Sampling rate (FPS)<input v-model="samplingInput" class="legacy-input" type="number" min="0.1" max="10" step="0.1" :disabled="!editable || saving"></label>
        <label>Minimum detection confidence<input v-model="form.confidence" class="legacy-input" type="number" min="0" max="1" step="0.01" :disabled="!editable || saving"></label>
        <label>Busy when presence exceeds<input v-model="busyThresholdInput" class="legacy-input" type="number" min="0" step="1" :disabled="!editable || saving"></label>
        <label>Minimum valid sample coverage<input v-model="coverageInput" class="legacy-input" type="number" min="0.5" max="1" step="0.05" :disabled="!editable || saving"></label>
        <label>Threshold status<select v-model="form.calibrationStatus" class="legacy-select" :disabled="!editable || saving"><option value="uncalibrated">Uncalibrated</option><option value="experimental">Experimental estimate</option><option value="calibrated">Calibrated estimate</option></select></label>
      </div>
      <fieldset class="roi-config__thresholds" :disabled="!editable || saving">
        <legend>Vehicle classes included in ROI presence</legend>
        <label v-for="vehicleClass in ['car', 'bus', 'truck', 'motorcycle', 'bicycle']" :key="vehicleClass" class="roi-config__class"><input v-model="includedClasses" type="checkbox" :value="vehicleClass"> {{ vehicleClass }}</label>
      </fieldset>
      <fieldset class="roi-config__thresholds" :disabled="!editable || saving">
        <legend>Average concurrent detections thresholds (vehicles present, not V/C)</legend>
        <p class="roi-config__note">Set five increasing camera-specific cutoffs for Great → Terrible. No universal or MKJI ROI thresholds are assumed.</p>
        <label v-for="(_, index) in thresholdInputs" :key="index">{{ ['Great / Good', 'Good / Average', 'Average / Poor', 'Poor / Bad', 'Bad / Terrible'][index] }}<input v-model="thresholdInputs[index]" class="legacy-input" type="number" min="0" step="0.1" placeholder="Not set"></label>
        <p v-if="thresholdPreview.length" class="roi-config__threshold-preview">Preview (average vehicles present): {{ thresholdPreview.map(({ label, range }) => `${label} ${range}`).join(' · ') }}.</p>
      </fieldset>
      <label v-if="form.calibrationStatus === 'calibrated'">Calibration evidence note<textarea v-model="form.calibrationNote" class="legacy-input" rows="3" minlength="12" /></label>
      <div class="roi-config__actions">
        <button class="legacy-button legacy-button--outline" type="button" :disabled="!editable || loading || !normalizedPoints.length" @click="exportConfig">Export Configuration JSON</button>
        <button class="legacy-button legacy-button--primary" type="button" :disabled="!editable || saving || loading || !videoReady" @click="save">{{ saving ? 'Saving…' : 'Save Configuration' }}</button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.roi-config { display: grid; gap: 12px; margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--green-theme-30); }
.roi-config h3 { margin: 0; font-size: .95rem; }
.roi-config__note { margin: 0; color: var(--ink-500); font-size: .78rem; line-height: 1.45; }
.roi-config__error { margin: 0; color: #bd392d; font-size: .82rem; }
.roi-config__source { display: grid; gap: 3px; font-size: .8rem; }
.roi-config__source strong { color: #a13b20; }
.roi-config__stage { position: relative; width: 100%; overflow: hidden; border-radius: 8px; background: #111; touch-action: none; }
.roi-config__stage video, .roi-config__stage svg { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }
.roi-config__stage video { object-fit: fill; }
.roi-config__stage svg { overflow: visible; touch-action: none; }
.roi-config__shape { fill: #21c55e38; stroke: #21c55e; stroke-width: 5; vector-effect: non-scaling-stroke; pointer-events: auto; }
.roi-config__shape--editable { cursor: move; }
.roi-config__handle { fill: #fff; stroke: #168c46; stroke-width: 4; vector-effect: non-scaling-stroke; cursor: grab; pointer-events: auto; }
.roi-config__handle--selected { fill: #f7c843; }
.roi-config__draft { fill: #21c55e38; stroke: #e5ffef; stroke-width: 4; stroke-dasharray: 10 8; vector-effect: non-scaling-stroke; pointer-events: none; }
.roi-config__actions { display: flex; flex-wrap: wrap; gap: 7px; }
.roi-config__fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.roi-config__fields label, .roi-config__thresholds label { display: grid; gap: 5px; font-size: .78rem; }
.roi-config__thresholds .roi-config__class { display: flex; align-items: center; gap: 7px; }
.roi-config__thresholds { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; min-width: 0; margin: 0; padding: 12px; border: 1px solid var(--green-theme-30); border-radius: 8px; }
.roi-config__thresholds legend { padding: 0 5px; font-size: .8rem; font-weight: 600; }
.roi-config__thresholds p { grid-column: 1 / -1; }
@media (max-width: 640px) { .roi-config__fields, .roi-config__thresholds { grid-template-columns: 1fr; } }
</style>
