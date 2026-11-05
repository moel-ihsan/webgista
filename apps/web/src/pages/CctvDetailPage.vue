<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { authSession } from '../auth/session'
import { appConfig } from '../config/app'
import { getCctvDetail, type CctvDetail } from '../data/cctvDetail'
import { listTrafficObservations } from '../data/trafficObservations'
import { privateImageUrl } from '../data/privateMedia'
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
let loadRevision = 0
let imageRefreshTimer: ReturnType<typeof setInterval> | null = null

const latest = computed(() => observations.value[0] ?? null)
const categoryLabel = computed(() => camera.value?.category === 'analytic' ? 'Analytic' : 'Regular')

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

watch([() => String(route.params.id ?? ''), () => authSession.state.status], ([id, authStatus]) => {
  const revision = ++loadRevision
  if (imageRefreshTimer) clearInterval(imageRefreshTimer)
  imageRefreshTimer = null
  camera.value = null
  observations.value = []
  imageUrl.value = null
  imageFailed.value = false
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
          <img v-if="imageUrl && !imageFailed" :src="imageUrl" :alt="`${camera.name} CCTV`" @error="imageFailed = true">
          <div v-else class="cctv-detail-fallback" role="status">
            <strong>{{ camera.category === 'analytic' ? 'Video unavailable' : 'Camera image unavailable' }}</strong>
            <span v-if="camera.category === 'analytic' && imageFailed">Secure video playback is not configured, and the camera image could not be loaded.</span>
            <span v-else-if="camera.category === 'analytic'">Secure video playback is not configured, and no camera image is available.</span>
            <span v-else-if="imageFailed">The authorized camera image could not be loaded.</span>
            <span v-else>No camera image has been uploaded or private media preview is unavailable.</span>
          </div>
          <p v-if="camera.category === 'analytic' && imageUrl && !imageFailed" class="cctv-detail-media-note">
            Secure video playback is not configured. Showing the uploaded CCTV image.
          </p>
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
.cctv-detail-media { position: relative; min-height: 550px; overflow: hidden; border-radius: 10px; background: var(--color-secondary); box-shadow: var(--shadow); }
.cctv-detail-media > img { display: block; width: 100%; height: 550px; object-fit: cover; }
.cctv-detail-fallback { display: grid; min-height: 550px; place-content: center; gap: 10px; padding: 28px; color: var(--text-color); text-align: center; }
.cctv-detail-fallback span, .cctv-detail-observation-meta, .cctv-detail-history span { color: var(--ink-500); font-size: .82rem; }
.cctv-detail-media-note { position: absolute; right: 12px; bottom: 12px; left: 12px; margin: 0; padding: 9px 12px; border-radius: 8px; color: var(--text-color); background: var(--color-secondary); font-size: .78rem; }
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
