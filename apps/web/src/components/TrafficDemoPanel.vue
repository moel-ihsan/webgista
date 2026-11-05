<script setup lang="ts">
import { computed, ref } from 'vue'

import { demoDetectionTotal, demoFrameAt, trafficDemoVideos, type DemoAnalysis } from '../data/trafficDemo'
import { roiDensityFrameAt } from '../domain/roiDensityResult'
import { rectangleToPolygon } from '../domain/roiDensity'

const selectedId = ref(trafficDemoVideos[0]?.id ?? '')
const currentTime = ref(0)
const selectedDemo = computed(() => trafficDemoVideos.find((sample) => sample.id === selectedId.value) ?? trafficDemoVideos[0]!)
const analysis = computed(() => selectedDemo.value.analysis)
const currentFrame = computed(() => demoFrameAt(analysis.value, currentTime.value))
const totalDetections = computed(() => demoDetectionTotal(analysis.value))
const density = computed(() => selectedDemo.value.roiDensity)
const densityFrame = computed(() => roiDensityFrameAt(density.value, currentTime.value))
const densityWindow = computed(() => density.value.windows.find((window) => currentTime.value >= window.window_started_at_seconds && currentTime.value < window.window_ended_at_seconds) ?? null)
const roiPoints = computed(() => density.value.roi_type === 'rectangle'
  ? rectangleToPolygon(density.value.roi_geometry as number[])
  : density.value.roi_geometry as [number, number][])
const vehicleLabels = [
  ['car', 'Car'], ['motorcycle', 'Motorcycle'], ['bus', 'Bus'], ['truck', 'Truck'], ['bicycle', 'Bicycle'],
] as const

function updateTime(event: Event): void {
  currentTime.value = (event.currentTarget as HTMLVideoElement).currentTime
}

function resetTime(): void {
  currentTime.value = 0
}

function crossingDescription(event: NonNullable<DemoAnalysis['crossing_events']>[number]): string {
  return `#${event.track_id} ${event.traffic_category ?? event.class} ${event.direction} at ${event.timestamp_seconds ?? 'unknown'}s`
}
</script>

<template>
  <section class="traffic-demo" aria-labelledby="traffic-demo-title">
    <div class="traffic-demo__heading">
      <div>
        <p class="eyebrow">OFFLINE MODEL DEMO</p>
        <h2 id="traffic-demo-title">Video Analytics</h2>
      </div>
      <span class="legacy-state-tag">DEMO · NOT LIVE CCTV</span>
    </div>

    <label class="traffic-demo__select-label" for="traffic-demo-select">Choose a demo video</label>
    <select id="traffic-demo-select" v-model="selectedId" class="traffic-demo__select" @change="resetTime">
      <option v-for="sample in trafficDemoVideos" :key="sample.id" :value="sample.id">
        {{ sample.title }} · {{ Math.round(sample.analysis.input_duration_seconds) }} sec
      </option>
    </select>

    <div class="traffic-demo__video-stage" :style="{ aspectRatio: `${density.video_dimensions.width} / ${density.video_dimensions.height}` }">
      <video
        :key="selectedDemo.id"
        class="traffic-demo__video"
        :src="selectedDemo.videoUrl"
        controls
        playsinline
        preload="metadata"
        :aria-label="`YOLOX annotated demo with ROI overlay: ${selectedDemo.title}`"
        @timeupdate="updateTime"
        @loadedmetadata="resetTime"
      >
        Your browser does not support H.264 video playback.
      </video>
      <svg class="traffic-demo__roi-overlay" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
        <polygon :points="roiPoints.map(([x, y]) => `${x * 1000},${y * 1000}`).join(' ')" />
      </svg>
    </div>

    <p class="traffic-demo__notice">
      Licensed stock-footage demo processed locally at {{ analysis.sampled_fps }} sampled frames per second for {{ analysis.input_duration_seconds }} seconds.
      It is not a live camera, and its results are not saved as Traffic Observations.
    </p>

    <div class="traffic-demo__meta">
      <a :href="selectedDemo.sourceUrl" target="_blank" rel="noreferrer">Source: {{ selectedDemo.title }} — {{ selectedDemo.creator }}</a>
      <a href="https://www.pexels.com/license/" target="_blank" rel="noreferrer">Pexels Free License</a>
    </div>

    <section class="traffic-demo__density" aria-label="Experimental ten-second ROI density results">
      <h3>10-second ROI Density · EXPERIMENTAL — DEMO VIDEO</h3>
      <p>Time-weighted concurrent vehicle detections inside the outlined image area. This is visual presence, not unique vehicles, traffic flow, V/C, or live CCTV. YOLOX detections were reused from the offline sampled analysis; no inference runs in the browser.</p>
      <p v-if="densityFrame">At {{ densityFrame.timestamp_seconds.toFixed(1) }} s: {{ densityFrame.vehicle_presence_total }} supported vehicle detections in ROI · image coverage {{ ((densityFrame.roi_image_coverage ?? 0) * 100).toFixed(1) }}%.</p>
      <p v-if="densityWindow">Current interval {{ densityWindow.window_started_at_seconds.toFixed(0) }}–{{ densityWindow.window_ended_at_seconds.toFixed(1) }} s · {{ densityWindow.status }} · classification {{ densityWindow.classification_status.replaceAll('_', ' ') }}{{ densityWindow.condition ? `: ${densityWindow.condition}` : '' }}.</p>
      <div class="traffic-demo__density-windows">
        <article v-for="(window, index) in density.windows" :key="window.window_started_at_seconds" class="traffic-demo__density-window">
          <strong>Window {{ index + 1 }} · {{ window.window_started_at_seconds.toFixed(0) }}–{{ window.window_ended_at_seconds.toFixed(1) }} s · {{ window.status }}</strong>
          <span>Average presence: {{ window.average_vehicles_present?.toFixed(2) ?? 'unavailable' }} · peak: {{ window.peak_vehicles_present ?? 'unavailable' }}</span>
          <span>Mean image coverage: {{ window.roi_image_coverage_average !== null ? `${(window.roi_image_coverage_average * 100).toFixed(1)}%` : 'unavailable' }} · busy: {{ window.busy_duration_seconds.toFixed(1) }}s ({{ window.busy_duration_percentage?.toFixed(1) ?? '—' }}%)</span>
          <span>Valid samples: {{ window.data_quality.valid_samples }}/{{ window.data_quality.expected_samples }} · observed {{ window.data_quality.effective_observation_seconds.toFixed(1) }}s</span>
          <span>Average presence — LV {{ window.traffic_category_statistics.LV.average?.toFixed(2) ?? '—' }}, HV {{ window.traffic_category_statistics.HV.average?.toFixed(2) ?? '—' }}, MC {{ window.traffic_category_statistics.MC.average?.toFixed(2) ?? '—' }}, bicycle {{ window.traffic_category_statistics.bicycle.average?.toFixed(2) ?? '—' }}.</span>
          <span>Category peaks — LV {{ window.traffic_category_statistics.LV.peak }}, HV {{ window.traffic_category_statistics.HV.peak }}, MC {{ window.traffic_category_statistics.MC.peak }}, bicycle {{ window.traffic_category_statistics.bicycle.peak }}.</span>
          <span>Condition: {{ window.condition ? window.condition : window.classification_status.replaceAll('_', ' ') }}</span>
        </article>
      </div>
      <p>Configured at {{ density.sampled_fps }} FPS · target {{ density.observation_window_seconds }}s windows / {{ density.refresh_seconds }}s refresh · model {{ density.provenance.model?.name ?? 'unknown' }}. Threshold calibration: {{ density.calibration_status }}. Partial footage is not treated as a complete interval.</p>
    </section>

    <div class="traffic-demo__summary" aria-live="polite">
      <p><strong>Model:</strong> {{ analysis.model.name }} · {{ analysis.model.version }}</p>
      <p><strong>Processed:</strong> {{ new Date(analysis.created_at).toLocaleString() }}</p>
      <p><strong>Detection instances:</strong> {{ totalDetections }} across {{ analysis.processed_frame_count }} sampled frames. These are repeated detections, not unique vehicles.</p>
      <p><strong>Tracker IDs:</strong> {{ analysis.tracked_objects_count }} experimental tracks ({{ analysis.tracking_quality.single_detection_track_count }} observed in one sampled frame). Track IDs are not ground-truth unique vehicles.</p>
      <p><strong>Experimental line-crossing events:</strong> {{ analysis.crossing_event_count }}; validation: {{ analysis.ground_truth_status.replaceAll('_', ' ') }}. These are not validated traffic counts.</p>
      <p><strong>Traffic Condition:</strong> unavailable — {{ analysis.condition_note }}</p>
      <h3>Detection instances by model class (repeated across frames)</h3>
      <ul class="traffic-demo__counts">
        <li v-for="[key, label] in vehicleLabels" :key="key">{{ label }} <strong>{{ analysis.detection_instances_by_class[key] }}</strong></li>
      </ul>
      <h3>Peak detections in one sampled frame</h3>
      <ul class="traffic-demo__counts">
        <li v-for="[key, label] in vehicleLabels" :key="key">{{ label }} <strong>{{ analysis.peak_vehicles_in_sampled_frame[key] }}</strong></li>
      </ul>
      <h3>Frame at {{ currentFrame?.offset_seconds.toFixed(1) ?? '0.0' }} sec</h3>
      <template v-if="currentFrame">
        <ul class="traffic-demo__counts">
          <li v-for="[key, label] in vehicleLabels" :key="key">{{ label }} <strong>{{ currentFrame.vehicle_counts_this_frame[key] }}</strong></li>
        </ul>
        <ol class="traffic-demo__detections">
          <li v-for="(detection, index) in currentFrame.detections" :key="`${currentFrame.offset_seconds}-${index}`">
            {{ detection.class }} → {{ detection.traffic_category }}<template v-if="detection.track_id != null"> · heuristic track {{ detection.track_id }}</template> · {{ Math.round(detection.confidence * 100) }}% confidence
            · box [{{ detection.bbox_xyxy.join(', ') }}]
          </li>
        </ol>
        <p v-if="currentFrame.line_crossings_this_frame?.length">Line crossings in this sampled frame: {{ currentFrame.line_crossings_this_frame.map(crossingDescription).join('; ') }}.</p>
        <p v-if="!currentFrame.detections.length">No supported vehicle detections in this sampled frame.</p>
      </template>
      <p><strong>Vehicle count semantics:</strong> {{ analysis.vehicle_count_semantics }}</p>
    </div>
  </section>
</template>
