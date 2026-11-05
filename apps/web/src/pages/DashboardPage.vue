<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

import { authSession } from '../auth/session'
import { appConfig } from '../config/app'
import TrafficMap from '../components/map/TrafficMap.vue'
import { accountPresentation } from '../data/accountPresentation'
import { formatRecentDate, listRecentlyAddedCctv, type RecentCctv } from '../data/dashboard'
import { listLatestTrafficObservations } from '../data/trafficObservations'
import type { TrafficObservation } from '../domain/traffic'
import { supabaseClient } from '../lib/supabase'

const recentCctv = ref<readonly RecentCctv[]>([])
const recentStatus = ref<'loading' | 'ready' | 'empty' | 'error'>('loading')
const latestObservation = ref<TrafficObservation | null>(null)
const conditionLabel = (value: TrafficObservation['condition']) => value ? value.charAt(0).toUpperCase() + value.slice(1) : 'No Data'
let recentController: AbortController | null = null

watch(() => authSession.state.status, (status) => {
  recentController?.abort()
  recentController = null
  recentCctv.value = []
  latestObservation.value = null
  if (status === 'loading') {
    recentStatus.value = 'loading'
    return
  }
  if (!supabaseClient) {
    recentStatus.value = 'error'
    return
  }
  const controller = new AbortController()
  recentController = controller
  recentStatus.value = 'loading'
  const observations = status === 'authenticated'
    ? listLatestTrafficObservations(supabaseClient).catch(() => [])
    : Promise.resolve([])
  void Promise.all([
    listRecentlyAddedCctv(supabaseClient, appConfig.privateMediaEnabled, controller.signal),
    observations,
  ])
    .then(([rows, traffic]) => {
      if (controller.signal.aborted) return
      recentCctv.value = rows
      latestObservation.value = [...traffic].sort((left, right) => Date.parse(right.windowEndedAt) - Date.parse(left.windowEndedAt))[0] ?? null
      recentStatus.value = rows.length ? 'ready' : 'empty'
    })
    .catch(() => {
      if (!controller.signal.aborted) {
        recentCctv.value = []
        recentStatus.value = 'error'
      }
    })
}, { immediate: true })

onBeforeUnmount(() => recentController?.abort())
</script>

<template>
  <div class="legacy-dashboard">
    <section class="legacy-dashboard__map" aria-labelledby="dashboard-map-title">
      <header class="legacy-section-heading">
        <h2 id="dashboard-map-title">CCTV Locations</h2>
        <span class="legacy-section-heading__note">Banda Aceh</span>
      </header>
      <div class="legacy-map-card">
        <TrafficMap compact />
        <div class="legacy-legend" aria-label="CCTV category legend">
          <h3>CCTV Category</h3>
          <div><span class="legend-dot legend-dot--analytic"></span>Analytic</div>
          <div><span class="legend-dot legend-dot--regular"></span>Regular</div>
          <p v-if="latestObservation">Latest authorized: {{ conditionLabel(latestObservation.condition) }} · {{ new Date(latestObservation.windowEndedAt).toLocaleString() }} ({{ latestObservation.sourceKind === 'manual' ? 'manual' : 'processed' }})</p>
          <p v-else>Latest authorized observation: No Data.</p>
        </div>
      </div>
    </section>

    <aside class="legacy-office-card" aria-labelledby="office-profile-title">
      <div class="legacy-office-card__photo" aria-hidden="true">
        <img v-if="accountPresentation.photoUrl" :src="accountPresentation.photoUrl" alt="">
        <span v-else>WebGIS</span>
      </div>
      <div class="legacy-office-card__content">
        <h2 id="office-profile-title">Office Profile</h2>
        <p class="legacy-unavailable">{{ accountPresentation.profile?.displayName || 'Your profile information' }}</p>
        <dl class="legacy-profile-fields">
          <div><dt>Address</dt><dd>{{ accountPresentation.profile?.address || 'Not provided' }}</dd></div>
          <div><dt>Coordinates</dt><dd>{{ accountPresentation.profile?.latitude != null && accountPresentation.profile.longitude != null ? `${accountPresentation.profile.latitude} N, ${accountPresentation.profile.longitude} E` : 'Not provided' }}</dd></div>
          <div><dt>Description</dt><dd>{{ accountPresentation.profile?.description || 'Not provided' }}</dd></div>
        </dl>
        <section class="legacy-recent" aria-labelledby="recent-cctv-title">
          <h3 id="recent-cctv-title">{{ authSession.state.status === 'authenticated' ? 'Recently Added' : 'Recently Updated' }}</h3>
          <p v-if="recentStatus === 'loading'" class="legacy-recent__empty" role="status">Loading CCTV locations…</p>
          <p v-else-if="recentStatus === 'error'" class="legacy-recent__empty" role="alert">Recently added CCTV could not be loaded.</p>
          <p v-else-if="recentStatus === 'empty'" class="legacy-recent__empty">No authorized CCTV locations are available.</p>
          <div v-else class="legacy-recent__items">
            <RouterLink
              v-for="camera in recentCctv"
              :key="camera.id"
              class="legacy-recent__item"
              :to="{ name: 'cctv-detail', params: { id: camera.id } }"
            >
              <img v-if="camera.imageUrl" :src="camera.imageUrl" :alt="`${camera.name} camera`" loading="lazy">
              <span v-else class="legacy-recent__image-fallback" aria-hidden="true">CCTV</span>
              <span class="legacy-recent__caption">
                <strong>{{ camera.name }}</strong>
                <small>{{ formatRecentDate(camera.date) }} · {{ camera.isActive ? 'Active' : 'Inactive' }}</small>
              </span>
            </RouterLink>
          </div>
        </section>
      </div>
    </aside>
  </div>
</template>
