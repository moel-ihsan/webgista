<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { authSession } from '../auth/session'
import { appConfig } from '../config/app'
import { getCctvDetail, type CctvDetail } from '../data/cctvDetail'
import { getCctvDemoAssociation, getPublicCctvDemoStream } from '../data/cctvDemoVideo'
import type { LiveDemoStream } from '../data/liveDemoStreams'
import { listTrafficObservations } from '../data/trafficObservations'
import { privateImageUrl } from '../data/privateMedia'
import { getCctvAnalysisConfig, type StoredRoiDensityConfig } from '../data/cctvAnalysisConfig'
import { getCurrentCctvRoiAnalysis, type CurrentRoiAnalysis, type RoiAnalysisResult } from '../data/cctvRoiAnalysis'
import { classifyV1RoiWindow, v1RoiRatio } from '../data/roiV1MarkerCondition'
import { demoDetectionTotal, type TrafficDemoVideo } from '../data/trafficDemo'
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
const liveDemoStream = ref<LiveDemoStream | null>(null)
const liveFrameFailed = ref(false)
const demoAnalysisConfig = ref<StoredRoiDensityConfig | null>(null)
const demoConfigStatus = ref<'unchecked' | 'loading' | 'ready' | 'error'>('unchecked')
const backendAnalysis = ref<CurrentRoiAnalysis | null>(null)
const backendAnalysisStatus = ref<'idle' | 'loading' | 'pending' | 'processing' | 'ready' | 'failed' | 'stale' | 'error'>('idle')
const videoAssociationReady = ref(false)
const videoLoading = ref(false)
const videoFailed = ref(false)
const videoAutoplayBlocked = ref(false)
const videoTime = ref(0)
const demoVideoElement = ref<HTMLVideoElement | null>(null)
const demoVideoStage = ref<HTMLDivElement | null>(null)
const fullscreenError = ref(false)
let loadRevision = 0
let imageRefreshTimer: ReturnType<typeof setInterval> | null = null
let analysisPollTimer: ReturnType<typeof setTimeout> | null = null
let analysisPollCount = 0

const latest = computed(() => observations.value[0] ?? null)
const categoryLabel = computed(() => camera.value?.category === 'analytic' ? 'Analytic' : 'Regular')
const demoDetections = computed(() => demoVideo.value ? demoDetectionTotal(demoVideo.value.analysis) : 0)
const demoDensityFrame = computed(() => !appConfig.roiAnalysisEnabled && demoVideo.value ? roiDensityFrameAt(demoVideo.value.roiDensity, videoTime.value) : null)
const activeDensityWindow = computed<RoiAnalysisResult | null>(() => {
  if (appConfig.roiAnalysisEnabled) return backendAnalysis.value?.results.find((window) => videoTime.value >= window.window_started_at_seconds && videoTime.value < window.window_ended_at_seconds) ?? null
  return demoVideo.value?.roiDensity.windows.find((window) => videoTime.value >= window.window_started_at_seconds && videoTime.value < window.window_ended_at_seconds) ?? null
})
const activeV1Estimate = computed(() => {
  const ratio = activeDensityWindow.value ? v1RoiRatio(activeDensityWindow.value) : null
  const condition = activeDensityWindow.value ? classifyV1RoiWindow(activeDensityWindow.value) : null
  return ratio === null || condition === null ? null : { ratio, condition }
})
function configKey(config: RoiDensityConfig): string {
  return JSON.stringify([
    config.roi_type, config.roi_geometry, config.video_dimensions, config.observation_window_seconds,
    config.refresh_seconds, config.sampled_fps, config.minimum_detection_confidence,
    [...config.included_classes].sort(), config.busy_threshold_vehicles, config.minimum_valid_coverage,
    config.density_thresholds, config.calibration_status, config.calibration_note, config.source_video_identifier,
  ])
}
const demoDensityStale = computed(() => {
  if (appConfig.roiAnalysisEnabled) return backendAnalysisStatus.value === 'stale'
  if (!demoVideo.value || !appConfig.roiDensityEnabled) return false
  if (demoConfigStatus.value !== 'ready') return true
  if (demoAnalysisConfig.value === null) return true
  return configKey(demoAnalysisConfig.value.configuration) !== configKey(demoVideo.value.roiDensity.configuration_snapshot)
    || demoVideo.value.roiDensity.configuration_version !== demoAnalysisConfig.value.configurationVersion
    || demoVideo.value.roiDensity.provenance.source_video_identifier !== demoAnalysisConfig.value.configuration.source_video_identifier
})
const demoRoiPoints = computed(() => {
  const config = demoAnalysisConfig.value?.configuration
  if (!config) return []
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

async function toggleVideoFullscreen(): Promise<void> {
  const stage = demoVideoStage.value
  if (!stage) return
  try {
    if (document.fullscreenElement === stage) await document.exitFullscreen()
    else await stage.requestFullscreen()
    fullscreenError.value = false
  } catch {
    fullscreenError.value = true
  }
}

function releaseDemoVideo(): void {
  const video = demoVideoElement.value
  if (!video) return
  video.pause()
  video.removeAttribute('src')
  video.load()
}

function stopAnalysisPolling(): void {
  if (analysisPollTimer) clearTimeout(analysisPollTimer)
  analysisPollTimer = null
}

async function refreshBackendAnalysis(revision: number, cameraId: string, sourceId: string, sourceHash: string, version: number): Promise<void> {
  if (!supabaseClient || revision !== loadRevision || !appConfig.roiAnalysisEnabled) return
  try {
    const result = await getCurrentCctvRoiAnalysis(supabaseClient, cameraId, sourceId, sourceHash, version)
    if (revision !== loadRevision) return
    backendAnalysis.value = result
    if (!result) backendAnalysisStatus.value = 'pending'
    else if (result.status === 'completed') backendAnalysisStatus.value = 'ready'
    else if (result.status === 'failed') backendAnalysisStatus.value = 'failed'
    else if (result.status === 'superseded') backendAnalysisStatus.value = 'stale'
    else backendAnalysisStatus.value = result.status
    if ((!result || ['pending', 'processing'].includes(result.status)) && analysisPollCount < 20) {
      analysisPollCount += 1
      analysisPollTimer = setTimeout(() => { void refreshBackendAnalysis(revision, cameraId, sourceId, sourceHash, version) }, 2500)
    }
  } catch {
    if (revision === loadRevision) backendAnalysisStatus.value = 'error'
  }
}

function onDemoVideoError(): void {
  releaseDemoVideo()
  videoFailed.value = true
  videoLoading.value = false
  demoVideo.value = null
  demoAnalysisConfig.value = null
  demoConfigStatus.value = 'unchecked'
  fullscreenError.value = false
}

watch([() => String(route.params.id ?? ''), () => authSession.state.status], ([id, authStatus]) => {
  const revision = ++loadRevision
  stopAnalysisPolling()
  releaseDemoVideo()
  if (imageRefreshTimer) clearInterval(imageRefreshTimer)
  imageRefreshTimer = null
  camera.value = null
  observations.value = []
  imageUrl.value = null
  imageFailed.value = false
  demoVideo.value = null
  liveDemoStream.value = null
  liveFrameFailed.value = false
  demoAnalysisConfig.value = null
  demoConfigStatus.value = 'unchecked'
  backendAnalysis.value = null
  backendAnalysisStatus.value = 'idle'
  analysisPollCount = 0
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
      videoAssociationReady.value = authStatus !== 'authenticated'

      if (authStatus === 'authenticated') {
        void getCctvDemoAssociation(client, id).then(({ video, liveStream }) => {
          if (revision === loadRevision) {
            demoVideo.value = video
            liveDemoStream.value = liveStream ?? liveDemoStream.value
            videoAssociationReady.value = true
            videoLoading.value = video !== null
            if (video && appConfig.roiDensityEnabled) {
              demoConfigStatus.value = 'loading'
              void getCctvAnalysisConfig(client, id).then((configuration) => {
                if (revision === loadRevision) {
                  demoAnalysisConfig.value = configuration
                  demoConfigStatus.value = 'ready'
                  if (appConfig.roiAnalysisEnabled && configuration) {
                    backendAnalysisStatus.value = 'loading'
                    void refreshBackendAnalysis(revision, id, video.analysis.source_video_identifier, video.analysis.source_video_sha256, configuration.configurationVersion)
                  }
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
      } else {
        void getPublicCctvDemoStream(client, id).then((stream) => {
          if (revision === loadRevision) {
            liveDemoStream.value = stream
            videoAssociationReady.value = true
          }
        }).catch(() => {
          if (revision === loadRevision) videoAssociationReady.value = true
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
  stopAnalysisPolling()
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
          <template v-if="liveDemoStream && !liveFrameFailed">
            <div class="cctv-detail-live-stage">
              <iframe
                :src="liveDemoStream.embedUrl"
                :title="`YouTube demo: ${liveDemoStream.title}`"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowfullscreen
                referrerpolicy="strict-origin-when-cross-origin"
                @error="liveFrameFailed = true"
              />
            </div>
            <p class="cctv-detail-demo-label">DEMO · YOUTUBE LIVE</p>
            <p class="cctv-detail-media-note"><a :href="liveDemoStream.sourceUrl" target="_blank" rel="noreferrer">Open YouTube video</a>.</p>
          </template>
          <template v-else-if="demoVideo && !videoFailed">
            <div ref="demoVideoStage" class="cctv-detail-video-stage" :style="{ aspectRatio: `${demoVideo.analysis.video_dimensions.width} / ${demoVideo.analysis.video_dimensions.height}` }">
              <div class="cctv-detail-video-content" :style="{ aspectRatio: `${demoVideo.analysis.video_dimensions.width} / ${demoVideo.analysis.video_dimensions.height}`, '--video-ratio': demoVideo.analysis.video_dimensions.width / demoVideo.analysis.video_dimensions.height }">
                <video
                  ref="demoVideoElement"
                  :key="demoVideo.id"
                  class="cctv-detail-video"
                  :src="demoVideo.playbackVideoUrl"
                  :poster="imageUrl || undefined"
                  autoplay
                  muted
                  controls
                  controlslist="nofullscreen"
                  playsinline
                  preload="metadata"
                  :aria-label="`Demo video, not live CCTV: ${demoVideo.title}`"
                  @loadeddata="videoLoading = false"
                  @canplay="attemptDemoAutoplay"
                  @timeupdate="updateDemoTime"
                  @error="onDemoVideoError"
                >Your browser does not support H.264 playback.</video>
                <svg v-if="demoRoiPoints.length" class="cctv-detail-roi" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-label="Saved camera detection area">
                  <polygon :points="demoRoiPoints.map(([x, y]) => `${(x * 1000).toFixed(2)},${(y * 1000).toFixed(2)}`).join(' ')" />
                </svg>
              </div>
              <button class="cctv-detail-fullscreen legacy-button legacy-button--outline" type="button" aria-label="View video and saved ROI fullscreen" @click="toggleVideoFullscreen">Fullscreen</button>
            </div>
            <p class="cctv-detail-demo-label">DEMO VIDEO — NOT LIVE CCTV</p>
            <p v-if="videoLoading" class="cctv-detail-media-note" role="status">Loading demo video…</p>
            <button v-if="videoAutoplayBlocked" class="legacy-button legacy-button--outline" type="button" @click="attemptDemoAutoplay">Play demo video</button>
            <p v-if="fullscreenError" class="cctv-detail-media-note" role="status">Fullscreen is unavailable in this browser.</p>
          </template>
          <template v-else-if="videoAssociationReady && imageUrl && !imageFailed">
            <img :src="imageUrl" :alt="`${camera.name} CCTV`" @error="imageFailed = true">
            <p v-if="liveFrameFailed" class="cctv-detail-media-note" role="status">The live YouTube embed is unavailable. <a v-if="liveDemoStream" :href="liveDemoStream.sourceUrl" target="_blank" rel="noreferrer">Open the source stream</a>. Showing the uploaded CCTV image.</p>
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
            <span>YOLOX-S detection instances: {{ demoDetections }} across {{ demoVideo.analysis.processed_frame_count }} sampled frames. These are repeated detections, not unique vehicles.</span>
            <span>Model: {{ demoVideo.analysis.model.name }} {{ demoVideo.analysis.model.version }} · sampled at {{ demoVideo.analysis.sampled_fps }} FPS · processed {{ dateLabel(demoVideo.analysis.created_at) }}.</span>
            <span v-if="demoConfigStatus === 'loading'" role="status">Loading the authorized saved ROI…</span>
            <span v-else-if="demoConfigStatus === 'error'" role="status">Saved ROI is unavailable to this account; camera-specific measurements are withheld.</span>
            <span v-else-if="!demoAnalysisConfig" role="status">No authorized camera ROI is available. Bundled demo geometry is not shown as this camera’s configuration.</span>
            <span v-else-if="appConfig.roiAnalysisEnabled && backendAnalysisStatus === 'loading'" role="status">Checking saved ROI analysis…</span>
            <span v-else-if="appConfig.roiAnalysisEnabled && backendAnalysisStatus === 'pending'" role="status">Analysis Pending — {{ backendAnalysis?.failureReason || 'save the ROI to schedule cached detection reaggregation.' }}</span>
            <span v-else-if="appConfig.roiAnalysisEnabled && backendAnalysisStatus === 'processing'" role="status">ROI analysis is processing.</span>
            <span v-else-if="appConfig.roiAnalysisEnabled && backendAnalysisStatus === 'failed'" role="status">Analysis Failed — {{ backendAnalysis?.failureReason || 'retry by saving the ROI again.' }}</span>
            <span v-else-if="appConfig.roiAnalysisEnabled && backendAnalysisStatus === 'error'" role="status">Analysis status is unavailable to this account.</span>
            <span v-else-if="appConfig.roiAnalysisEnabled && backendAnalysisStatus === 'ready'" role="status">Analysis Ready — current results match the saved ROI and video source.</span>
            <span v-else-if="(appConfig.roiAnalysisEnabled && backendAnalysisStatus === 'stale') || (!appConfig.roiAnalysisEnabled && demoDensityStale)" role="status">Analysis Stale — the saved ROI configuration does not match this result.</span>
            <template v-if="appConfig.roiAnalysisEnabled ? backendAnalysisStatus === 'ready' : appConfig.roiDensityEnabled && demoAnalysisConfig && !demoDensityStale">
              <span v-if="!appConfig.roiAnalysisEnabled && demoDensityFrame">ROI Detection at {{ demoDensityFrame.timestamp_seconds.toFixed(1) }}s: {{ demoDensityFrame.vehicle_presence_total }} vehicles present in the sampled frame.</span>
              <template v-if="activeDensityWindow">
                <span>Observation interval: {{ activeDensityWindow.window_started_at_seconds }}–{{ activeDensityWindow.window_ended_at_seconds }} seconds · {{ activeDensityWindow.status }}.</span>
                <span>Average Vehicles: {{ activeDensityWindow.average_vehicles_present?.toFixed(2) ?? 'unavailable' }} · Peak: {{ activeDensityWindow.peak_vehicles_present ?? 'unavailable' }} · Observation Duration: {{ activeDensityWindow.window_duration_seconds.toFixed(1) }} seconds.</span>
                <span>Vehicle Classes — LV {{ activeDensityWindow.traffic_category_statistics.LV.average?.toFixed(2) ?? '—' }}, HV {{ activeDensityWindow.traffic_category_statistics.HV.average?.toFixed(2) ?? '—' }}, MC {{ activeDensityWindow.traffic_category_statistics.MC.average?.toFixed(2) ?? '—' }}, bicycle {{ activeDensityWindow.traffic_category_statistics.bicycle.average?.toFixed(2) ?? '—' }}.</span>
                <span>ROI Coverage: {{ activeDensityWindow.roi_image_coverage_average !== null ? `${(activeDensityWindow.roi_image_coverage_average * 100).toFixed(1)}%` : 'unavailable' }} · Busy duration: {{ activeDensityWindow.busy_duration_seconds.toFixed(1) }}s · Valid samples: {{ activeDensityWindow.data_quality.valid_samples }}/{{ activeDensityWindow.data_quality.expected_samples }} · Measurement Status: {{ activeDensityWindow.status }} / {{ activeDensityWindow.classification_status.replaceAll('_', ' ') }}.</span>
                <span>Traffic Condition: {{ activeDensityWindow.condition ? activeDensityWindow.condition : `No Data — ${activeDensityWindow.condition_reason}` }}</span>
                <span>V1-style marker estimate: {{ activeV1Estimate ? `${activeV1Estimate.condition} (ratio ${activeV1Estimate.ratio.toFixed(3)})` : 'No Data — valid complete ROI window unavailable' }}. Experimental 10-second estimate using the original v1 coefficients; it does not change saved observations.</span>
              </template>
              <span v-else-if="appConfig.roiAnalysisEnabled" role="status">No saved analysis window matches the current playback position.</span>
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
.cctv-detail-video-stage { position: relative; display: grid; width: 100%; overflow: hidden; place-items: center; background: #101311; }
.cctv-detail-live-stage { width: 100%; aspect-ratio: 16 / 9; background: #101311; }
.cctv-detail-live-stage iframe { display: block; width: 100%; height: 100%; border: 0; }
.cctv-detail-video-content { position: relative; width: 100%; overflow: hidden; }
.cctv-detail-video-stage:fullscreen { width: 100vw; height: 100vh; aspect-ratio: auto !important; }
.cctv-detail-video-stage:fullscreen .cctv-detail-video-content { width: min(100vw, calc(100vh * var(--video-ratio))); height: min(100vh, calc(100vw / var(--video-ratio))); }
.cctv-detail-video { display: block; width: 100%; height: 100%; object-fit: fill; background: #101311; }
.cctv-detail-roi { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.cctv-detail-roi polygon { fill: #21c55e24; stroke: #21c55e; stroke-width: 6; vector-effect: non-scaling-stroke; }
.cctv-detail-fullscreen { position: absolute; z-index: 2; right: 12px; bottom: 12px; }
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
