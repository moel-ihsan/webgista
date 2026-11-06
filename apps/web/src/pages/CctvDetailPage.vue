<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { authSession } from '../auth/session'
import { appConfig } from '../config/app'
import { getCctvDetail, type CctvDetail } from '../data/cctvDetail'
import { getCctvDemoAssociation } from '../data/cctvDemoVideo'
import { listTrafficObservations } from '../data/trafficObservations'
import { privateImageUrl } from '../data/privateMedia'
import { getCctvAnalysisConfig, type StoredRoiDensityConfig } from '../data/cctvAnalysisConfig'
import { demoDetectionTotal, demoFrameAt, type TrafficDemoVideo } from '../data/trafficDemo'
import { rectangleToPolygon, type RoiDensityConfig } from '../domain/roiDensity'
import { roiDensityFrameAt } from '../domain/roiDensityResult'
import type { TrafficObservation } from '../domain/traffic'
import { supabaseClient } from '../lib/supabase'

const route = useRoute()
const router = useRouter()
const camera = ref<CctvDetail | null>(null)
const observations = ref<readonly TrafficObservation[]>([])
const pageStatus = ref<'loading' | 'ready' | 'not-found' | 'error'>('loading')
const observationStatus = ref<'loading' | 'ready' | 'unavailable' | 'error'>('loading')
const imageUrl = ref<string | null>(null)
const imageFailed = ref(false)
const demoVideo = ref<TrafficDemoVideo | null>(null)
const demoAnalysisConfig = ref<StoredRoiDensityConfig | null>(null)
const demoAssociationEditable = ref(false)
const demoConfigStatus = ref<'unchecked' | 'loading' | 'ready' | 'error'>('unchecked')
const videoAssociationReady = ref(false)
const videoLoading = ref(false)
const videoFailed = ref(false)
const videoAutoplayBlocked = ref(false)
const videoTime = ref(0)
const demoVideoElement = ref<HTMLVideoElement | null>(null)
let loadRevision = 0
let imageRefreshTimer: ReturnType<typeof setInterval> | null = null

const latest = computed(() => observations.value[0] ?? null)
const categoryLabel = computed(() => camera.value?.category === 'analytic' ? 'Analytic' : 'Regular')
const demoFrame = computed(() => demoVideo.value ? demoFrameAt(demoVideo.value.analysis, videoTime.value) : null)
const demoDetections = computed(() => demoVideo.value ? demoDetectionTotal(demoVideo.value.analysis) : 0)
const demoDensityFrame = computed(() => demoVideo.value ? roiDensityFrameAt(demoVideo.value.roiDensity, videoTime.value) : null)
const demoDensityWindow = computed(() => demoVideo.value?.roiDensity.windows.find((window) => videoTime.value >= window.window_started_at_seconds && videoTime.value < window.window_ended_at_seconds) ?? null)
function configKey(config: RoiDensityConfig): string {
  return JSON.stringify([
    config.roi_type, config.roi_geometry, config.video_dimensions, config.observation_window_seconds,
    config.refresh_seconds, config.sampled_fps, config.minimum_detection_confidence,
    [...config.included_classes].sort(), config.busy_threshold_vehicles, config.minimum_valid_coverage,
    config.density_thresholds, config.calibration_status, config.calibration_note, config.source_video_identifier,
  ])
}
const demoDensityStale = computed(() => {
  if (!demoVideo.value || !appConfig.roiDensityEnabled || !demoAssociationEditable.value) return false
  if (demoConfigStatus.value !== 'ready') return true
  if (demoAnalysisConfig.value === null) return false
  return configKey(demoAnalysisConfig.value.configuration) !== configKey(demoVideo.value.roiDensity.configuration_snapshot)
    || demoVideo.value.roiDensity.configuration_version !== demoAnalysisConfig.value.configurationVersion
    || demoVideo.value.roiDensity.provenance.camera_id !== camera.value?.id
    || demoVideo.value.roiDensity.provenance.source_video_identifier !== demoAnalysisConfig.value.configuration.source_video_identifier
})
const demoRoiPoints = computed(() => {
  const result = demoVideo.value?.roiDensity
  if (!result) return []
  const config = demoAnalysisConfig.value?.configuration ?? result.configuration_snapshot
  return config.roi_type === 'rectangle' ? rectangleToPolygon(config.roi_geometry as number[]) : config.roi_geometry as [number, number][]
})

function dateLabel(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Time unavailable' : date.toLocaleString()
}

function conditionLabel(value: TrafficObservation['condition'] | null | undefined): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : 'No Data'
}

function sourceLabel(observation: TrafficObservation): string {
  if (observation.sourceKind === 'manual') return 'Manual'
  if (observation.sourceKind === 'v1_import') return 'Legacy import'
  return 'Computer Vision'
}

function updateDemoTime(event: Event): void {
  videoTime.value = (event.currentTarget as HTMLVideoElement).currentTime
}

function attemptDemoAutoplay(): void {
  if (!demoVideoElement.value) return
  void demoVideoElement.value.play().then(() => {
    videoAutoplayBlocked.value = false
  }).catch(() => {
    videoAutoplayBlocked.value = true
  })
}

function releaseDemoVideo(): void {
  const video = demoVideoElement.value
  if (!video) return
  video.pause()
  video.removeAttribute('src')
  video.load()
}

function onDemoVideoError(): void {
  releaseDemoVideo()
  videoFailed.value = true
  videoLoading.value = false
  demoVideo.value = null
  demoAnalysisConfig.value = null
  demoAssociationEditable.value = false
  demoConfigStatus.value = 'unchecked'
}

watch([() => String(route.params.id ?? ''), () => authSession.state.status], ([id, authStatus]) => {
  const revision = ++loadRevision
  releaseDemoVideo()
  if (imageRefreshTimer) clearInterval(imageRefreshTimer)
  imageRefreshTimer = null
  camera.value = null
  observations.value = []
  imageUrl.value = null
  imageFailed.value = false
  demoVideo.value = null
  videoAssociationReady.value = authStatus !== 'authenticated'
  videoLoading.value = false
  videoFailed.value = false
  videoAutoplayBlocked.value = false
  videoTime.value = 0
  observationStatus.value = authStatus === 'authenticated' ? 'loading' : 'unavailable'
  if (authStatus === 'loading') {
    pageStatus.value = 'loading'
    return
  }
  if (!id || !supabaseClient) {
    pageStatus.value = supabaseClient ? 'not-found' : 'error'
    return
  }

  const client = supabaseClient
  pageStatus.value = 'loading'
  void (async () => {
    try {
      const result = await getCctvDetail(client, id, authStatus === 'authenticated')
      if (revision !== loadRevision) return
      if (!result) {
        pageStatus.value = 'not-found'
        return
      }
      camera.value = result
      pageStatus.value = 'ready'

      if (authStatus === 'authenticated') {
        void getCctvDemoAssociation(client, id).then(({ video, editable }) => {
          if (revision === loadRevision) {
            demoVideo.value = video
            demoAssociationEditable.value = editable
            videoAssociationReady.value = true
            videoLoading.value = video !== null
            if (video && appConfig.roiDensityEnabled && editable) {
              demoConfigStatus.value = 'loading'
              void getCctvAnalysisConfig(client, id).then((configuration) => {
                if (revision === loadRevision) {
                  demoAnalysisConfig.value = configuration
                  demoConfigStatus.value = 'ready'
                }
              }).catch(() => {
                if (revision === loadRevision) demoConfigStatus.value = 'error'
              })
            }
          }
        }).catch(() => {
          // Restricted or unavailable sources use the authorized CCTV image fallback.
          if (revision === loadRevision) {
            videoAssociationReady.value = true
            demoConfigStatus.value = 'error'
          }
        })
      }

      if (result.snapshotPath && appConfig.privateMediaEnabled) {
        const refreshImage = async () => {
          try {
            const signedUrl = await privateImageUrl(client, 'cctv-images', result.snapshotPath)
            if (revision === loadRevision) {
              imageUrl.value = signedUrl
              imageFailed.value = false
            }
          } catch {
            if (revision === loadRevision) imageFailed.value = true
          }
        }
        void refreshImage()
        imageRefreshTimer = setInterval(() => { void refreshImage() }, 240_000)
      }

      if (authStatus === 'authenticated') {
        void listTrafficObservations(client, id).then((rows) => {
          if (revision === loadRevision) {
            observations.value = rows
            observationStatus.value = 'ready'
          }
        }).catch(() => {
          if (revision === loadRevision) observationStatus.value = 'error'
        })
      }
    } catch {
      if (revision === loadRevision) pageStatus.value = 'error'
    }
  })()
}, { immediate: true })

onBeforeUnmount(() => {
  loadRevision += 1
  if (imageRefreshTimer) clearInterval(imageRefreshTimer)
  releaseDemoVideo()
})
</script>

<template>
  <section class="cctv-detail-page" aria-labelledby="cctv-detail-heading">
    <p v-if="pageStatus === 'loading'" class="legacy-table__empty" role="status">Loading CCTV details…</p>
    <div v-else-if="pageStatus === 'error'" class="legacy-table__empty" role="alert">
      <strong>CCTV details are unavailable.</strong>
      <p>Check your connection and try again.</p>
      <button class="legacy-button legacy-button--outline" type="button" @click="router.go(0)">Retry</button>
    </div>
    <div v-else-if="pageStatus === 'not-found'" class="legacy-table__empty" role="status">
      <strong>CCTV location not found or not available to this account.</strong>
      <p>Private camera details require an authorized account.</p>
      <RouterLink class="legacy-button legacy-button--outline" to="/map">Back to Map</RouterLink>
    </div>

    <template v-else-if="camera">
      <header class="legacy-section-heading">
        <h2 id="cctv-detail-heading">View CCTV</h2>
        <span class="legacy-section-heading__note">{{ camera.name }}</span>
      </header>

      <div class="cctv-detail-layout">
        <section class="cctv-detail-media" :aria-label="`${camera.name} camera media`">
          <template v-if="demoVideo && !videoFailed">
            <div class="cctv-detail-video-stage" :style="{ aspectRatio: `${demoVideo.analysis.video_dimensions.width} / ${demoVideo.analysis.video_dimensions.height}` }">
              <video
                ref="demoVideoElement"
                :key="demoVideo.id"
                class="cctv-detail-video"
                :src="demoVideo.videoUrl"
                :poster="imageUrl || undefined"
                autoplay
                muted
                controls
                playsinline
                preload="metadata"
                :aria-label="`Demo video, not live CCTV: ${demoVideo.title}`"
                @loadeddata="videoLoading = false"
                @canplay="attemptDemoAutoplay"
                @timeupdate="updateDemoTime"
                @error="onDemoVideoError"
              >Your browser does not support H.264 playback.</video>
              <svg class="cctv-detail-roi" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-label="Experimental detection area">
                <polygon :points="demoRoiPoints.map(([x, y]) => `${x * 1000},${y * 1000}`).join(' ')" />
              </svg>
            </div>
            <p class="cctv-detail-demo-label">DEMO VIDEO — NOT LIVE CCTV</p>
            <p v-if="videoLoading" class="cctv-detail-media-note" role="status">Loading demo video…</p>
            <button v-if="videoAutoplayBlocked" class="legacy-button legacy-button--outline" type="button" @click="attemptDemoAutoplay">Play demo video</button>
          </template>
          <template v-else-if="videoAssociationReady && imageUrl && !imageFailed">
            <img :src="imageUrl" :alt="`${camera.name} CCTV`" @error="imageFailed = true">
            <p v-if="videoFailed" class="cctv-detail-media-note" role="status">Demo video unavailable. Showing the uploaded CCTV image.</p>
          </template>
          <div v-else class="cctv-detail-fallback" role="status">
            <template v-if="!videoAssociationReady">Checking authorized video source…</template>
            <template v-else>
            <strong>{{ camera.category === 'analytic' ? 'Video unavailable' : 'Camera image unavailable' }}</strong>
            <span v-if="camera.category === 'analytic' && imageFailed">No authorized playable video or accessible camera image is available.</span>
            <span v-else-if="camera.category === 'analytic'">No authorized playable video or uploaded camera image is available.</span>
            <span v-else-if="imageFailed">The authorized camera image could not be loaded.</span>
            <span v-else>No camera image has been uploaded or private media preview is unavailable.</span>
            </template>
          </div>
        </section>

        <aside class="cctv-detail-info" aria-label="CCTV information">
          <div class="cctv-detail-thumbnail">
            <img v-if="imageUrl && !imageFailed" :src="imageUrl" :alt="`${camera.name} thumbnail`">
            <span v-else aria-hidden="true">CCTV</span>
            <span class="cctv-category-tag" :class="`cctv-category-tag--${camera.category}`">{{ categoryLabel }}</span>
          </div>
          <h1>{{ camera.name }}</h1>
          <p class="cctv-detail-address">{{ camera.address || 'Address not recorded' }}</p>
          <p class="cctv-detail-coordinate">{{ camera.longitude.toFixed(6) }} E · {{ camera.latitude.toFixed(6) }} N</p>
          <p class="cctv-detail-agency">{{ camera.agencyName || 'Agency unavailable' }}</p>

          <section v-if="demoVideo && !videoFailed" class="cctv-detail-cv" aria-label="Offline demo video analysis">
            <strong>DEMO VIDEO — NOT LIVE CCTV</strong>
            <span>Source: <a :href="demoVideo.sourceUrl" target="_blank" rel="noreferrer">{{ demoVideo.title }} — {{ demoVideo.creator }}</a> · <a href="https://www.pexels.com/license/" target="_blank" rel="noreferrer">Pexels Free License</a>.</span>
            <span>{{ demoDetections }} detection instances across {{ demoVideo.analysis.processed_frame_count }} sampled frames; not unique vehicles.</span>
            <span>{{ demoVideo.analysis.tracked_objects_count }} heuristic track IDs and {{ demoVideo.analysis.crossing_event_count }} line-crossing events; ground truth {{ demoVideo.analysis.ground_truth_status.replaceAll('_', ' ') }}.</span>
            <span>No traffic condition is calculated from this experimental footage: {{ demoVideo.analysis.condition_note }}</span>
            <span>Model: {{ demoVideo.analysis.model.name }} {{ demoVideo.analysis.model.version }} · sampled at {{ demoVideo.analysis.sampled_fps }} FPS · processed {{ dateLabel(demoVideo.analysis.created_at) }}.</span>
            <span v-if="demoVideo.analysis.tracking.algorithm">Tracker: {{ demoVideo.analysis.tracking.algorithm }}; {{ demoVideo.analysis.tracking.quality }}.</span>
            <span v-if="demoFrame">Frame at {{ demoFrame.offset_seconds.toFixed(1) }}s: {{ demoFrame.detections.length }} vehicle detections.</span>
            <span v-if="demoConfigStatus === 'loading'" role="status">Checking whether the stored ROI matches this analysis…</span>
            <span v-else-if="demoConfigStatus === 'error'" role="status">Saved ROI status is unavailable; ROI results are withheld until it can be checked.</span>
            <span v-else-if="demoDensityStale" role="status">This analysis is stale: the saved ROI or analysis settings changed. Export the saved configuration and rerun the local offline analyzer for this source video. Results are not uploaded or published automatically.</span>
            <template v-else>
              <span v-if="demoDensityFrame">Bundled demo ROI presence at current sampled frame: {{ demoDensityFrame.vehicle_presence_total }} detections · image coverage {{ ((demoDensityFrame.roi_image_coverage ?? 0) * 100).toFixed(1) }}%.</span>
              <template v-if="demoDensityWindow">
                <span>10-second ROI window {{ demoDensityWindow.window_started_at_seconds }}–{{ demoDensityWindow.window_ended_at_seconds }}s ({{ demoDensityWindow.status }}): average presence {{ demoDensityWindow.average_vehicles_present?.toFixed(2) ?? 'unavailable' }}, peak {{ demoDensityWindow.peak_vehicles_present ?? 'unavailable' }}.</span>
                <span>Busy {{ demoDensityWindow.busy_duration_seconds.toFixed(1) }}s; valid coverage {{ (demoDensityWindow.data_quality.valid_observation_coverage * 100).toFixed(1) }}%; estimate state {{ demoDensityWindow.classification_status.replaceAll('_', ' ') }}{{ demoDensityWindow.condition ? ` (${demoDensityWindow.condition})` : '' }}.</span>
                <span>Average presence by class — LV {{ demoDensityWindow.traffic_category_statistics.LV.average?.toFixed(2) ?? '—' }}, HV {{ demoDensityWindow.traffic_category_statistics.HV.average?.toFixed(2) ?? '—' }}, MC {{ demoDensityWindow.traffic_category_statistics.MC.average?.toFixed(2) ?? '—' }}, bicycle {{ demoDensityWindow.traffic_category_statistics.bicycle.average?.toFixed(2) ?? '—' }}.</span>
              </template>
              <span v-if="!demoAnalysisConfig && appConfig.roiDensityEnabled">No camera-specific ROI is saved; values use the demo's bundled ROI only.</span>
            </template>
            <span>ROI density is visual presence only. Demo footage does not update the saved Traffic Condition or Observation History.</span>
            <span>Experimental demo footage; it does not depict current traffic at this camera location.</span>
          </section>

          <section class="cctv-detail-observations" aria-labelledby="cctv-observation-heading">
            <h2 id="cctv-observation-heading">Traffic Condition</h2>
            <p v-if="observationStatus === 'loading'" role="status">Loading observations…</p>
            <p v-else-if="observationStatus === 'error'" role="alert">Traffic observations are unavailable to this account.</p>
            <template v-else>
              <p class="cctv-detail-condition">{{ conditionLabel(latest?.condition) }}</p>
              <p v-if="latest" class="cctv-detail-observation-meta">{{ dateLabel(latest.windowEndedAt) }} · {{ sourceLabel(latest) }}</p>
              <p v-else class="cctv-detail-observation-meta">No saved observation is available to this account.</p>
            </template>
          </section>

          <section v-if="observations.length" class="cctv-detail-history" aria-labelledby="cctv-history-heading">
            <h2 id="cctv-history-heading">Observation History</h2>
            <ol>
              <li v-for="observation in observations" :key="observation.id">
                <strong>{{ conditionLabel(observation.condition) }}</strong>
                <span>{{ dateLabel(observation.windowEndedAt) }} · {{ sourceLabel(observation) }}</span>
              </li>
            </ol>
          </section>

          <nav class="cctv-detail-actions" aria-label="CCTV detail actions">
            <button class="legacy-button legacy-button--outline" type="button" @click="router.back()">Back</button>
            <RouterLink class="legacy-button legacy-button--primary" :to="{ name: 'map', query: { cctv: camera.id } }">View on Map</RouterLink>
          </nav>
        </aside>
      </div>
    </template>
  </section>
</template>

<style scoped>
.cctv-detail-page { width: 100%; min-width: 0; }
.cctv-detail-layout { display: grid; grid-template-columns: minmax(0, 5fr) minmax(280px, 3fr); gap: 30px; align-items: start; }
.cctv-detail-media { position: relative; display: flex; flex-direction: column; justify-content: center; min-height: 550px; overflow: hidden; border-radius: 10px; background: var(--color-secondary); box-shadow: var(--shadow); }
.cctv-detail-media > img { display: block; width: 100%; height: 550px; object-fit: cover; }
.cctv-detail-video-stage { position: relative; width: 100%; overflow: hidden; background: #101311; }
.cctv-detail-video { display: block; width: 100%; height: 100%; object-fit: fill; background: #101311; }
.cctv-detail-roi { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.cctv-detail-roi polygon { fill: #21c55e24; stroke: #21c55e; stroke-width: 6; vector-effect: non-scaling-stroke; }
.cctv-detail-demo-label { position: absolute; top: 12px; left: 12px; z-index: 1; margin: 0; padding: 7px 10px; border-radius: 6px; color: #fff; background: #a13b20; font-size: .78rem; font-weight: 700; }
.cctv-detail-fallback { display: grid; min-height: 550px; place-content: center; gap: 10px; padding: 28px; color: var(--text-color); text-align: center; }
.cctv-detail-fallback span, .cctv-detail-observation-meta, .cctv-detail-history span { color: var(--ink-500); font-size: .82rem; }
.cctv-detail-media-note { position: absolute; right: 12px; bottom: 12px; left: 12px; margin: 0; padding: 9px 12px; border-radius: 8px; color: var(--text-color); background: var(--color-secondary); font-size: .78rem; }
.cctv-detail-cv { display: grid; gap: 6px; margin-top: 12px; padding: 10px; border-radius: 8px; background: var(--color-primary); font-size: .75rem; }
.cctv-detail-cv a { color: var(--green-theme); }
.cctv-detail-info { min-width: 0; padding: 15px; border-radius: 10px; color: var(--text-color); background: var(--color-secondary); box-shadow: var(--shadow); }
.cctv-detail-thumbnail { position: relative; height: 150px; overflow: hidden; border-radius: 10px; background: var(--color-primary); }
.cctv-detail-thumbnail img { width: 100%; height: 100%; object-fit: cover; }
.cctv-detail-thumbnail > span:last-child { position: absolute; top: 10px; right: 10px; }
.cctv-detail-info h1 { margin: 14px 0 5px; font-size: 1.12rem; font-weight: 600; }
.cctv-detail-address, .cctv-detail-agency { margin: 4px 0; font-size: .82rem; }
.cctv-detail-coordinate { margin: 5px 0; color: var(--green-theme); font-size: .8rem; }
.cctv-detail-observations, .cctv-detail-history { margin-top: 22px; padding-top: 14px; border-top: 1px solid var(--green-theme-30); }
.cctv-detail-observations h2, .cctv-detail-history h2 { margin: 0 0 8px; font-size: .88rem; }
.cctv-detail-condition { margin: 0; font-size: 1rem; font-weight: 600; }
.cctv-detail-observation-meta { margin: 5px 0; }
.cctv-detail-history ol { display: grid; gap: 9px; max-height: 220px; margin: 0; padding: 0; overflow: auto; list-style: none; }
.cctv-detail-history li { display: grid; gap: 3px; font-size: .82rem; }
.cctv-detail-actions { display: flex; gap: 10px; margin-top: 22px; }
@media (max-width: 760px) { .cctv-detail-layout { grid-template-columns: minmax(0, 1fr); gap: 16px; } .cctv-detail-media, .cctv-detail-fallback { min-height: 320px; } .cctv-detail-media > img { height: 320px; } }
</style>
