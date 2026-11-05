<script setup lang="ts">
import { computed, ref } from 'vue'

import { demoDetectionTotal, demoFrameAt, trafficDemoVideos } from '../data/trafficDemo'

const selectedId = ref(trafficDemoVideos[0]?.id ?? '')
const currentTime = ref(0)
const selectedDemo = computed(() => trafficDemoVideos.find((sample) => sample.id === selectedId.value) ?? trafficDemoVideos[0]!)
const analysis = computed(() => selectedDemo.value.analysis)
const currentFrame = computed(() => demoFrameAt(analysis.value, currentTime.value))
const totalDetections = computed(() => demoDetectionTotal(analysis.value))
const vehicleLabels = [
  ['car', 'Car'], ['motorcycle', 'Motorcycle'], ['bus', 'Bus'], ['truck', 'Truck'], ['bicycle', 'Bicycle'],
] as const

function updateTime(event: Event): void {
  currentTime.value = (event.currentTarget as HTMLVideoElement).currentTime
}

function resetTime(): void {
  currentTime.value = 0
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

    <video
      :key="selectedDemo.id"
      class="traffic-demo__video"
      :src="selectedDemo.videoUrl"
      controls
      playsinline
      preload="metadata"
      :aria-label="`YOLOX annotated demo: ${selectedDemo.title}`"
      @timeupdate="updateTime"
      @loadedmetadata="resetTime"
    >
      Your browser does not support H.264 video playback.
    </video>

    <p class="traffic-demo__notice">
      Licensed stock-footage demo processed locally at {{ analysis.sampled_fps }} sampled frame per second.
      It is not a live camera, and its results are not saved as Traffic Observations.
    </p>

    <div class="traffic-demo__meta">
      <a :href="selectedDemo.sourceUrl" target="_blank" rel="noreferrer">Source: {{ selectedDemo.title }} — {{ selectedDemo.creator }}</a>
      <a href="https://www.pexels.com/license/" target="_blank" rel="noreferrer">Pexels Free License</a>
    </div>

    <div class="traffic-demo__summary" aria-live="polite">
      <p><strong>Model:</strong> {{ analysis.model.name }} · {{ analysis.model.version }}</p>
      <p><strong>Processed:</strong> {{ new Date(analysis.created_at).toLocaleString() }}</p>
      <p><strong>Detection instances:</strong> {{ totalDetections }} across {{ analysis.frames.length }} sampled frames. These are not unique vehicles.</p>
      <p v-if="analysis.line_crossing_total != null"><strong>Experimental heuristic line crossings:</strong> {{ analysis.line_crossing_total }} across the configured line. This is not a validated unique-vehicle count.</p>
      <p v-else><strong>Tracking:</strong> {{ analysis.tracking.enabled ? 'Heuristic IDs only; no line-crossing total is available.' : 'Not available.' }} <strong>Traffic condition:</strong> Not calculated.</p>
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
            {{ detection.class }}<template v-if="detection.track_id != null"> · heuristic track {{ detection.track_id }}</template> · {{ Math.round(detection.confidence * 100) }}% confidence
            · box [{{ detection.bbox_xyxy.join(', ') }}]
          </li>
        </ol>
        <p v-if="currentFrame.line_crossings_this_frame?.length">Line crossings in this sampled frame: {{ currentFrame.line_crossings_this_frame.length }} experimental event(s).</p>
        <p v-if="!currentFrame.detections.length">No supported vehicle detections in this sampled frame.</p>
      </template>
      <p><strong>Vehicle count semantics:</strong> {{ analysis.vehicle_count_semantics }}</p>
    </div>
  </section>
</template>
