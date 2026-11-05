<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { authSession } from '../auth/session'
import { listCctvLocations, type CctvManagementLocation } from '../data/cctvManagement'
import { createManualTrafficObservation, listTrafficObservations, type ManualObservationInput } from '../data/trafficObservations'
import type { TrafficCondition, TrafficObservation } from '../domain/traffic'
import { supabaseClient } from '../lib/supabase'

const cameras = ref<readonly CctvManagementLocation[]>([])
const selectedCameraId = ref('')
const observations = ref<readonly TrafficObservation[]>([])
const condition = ref<TrafficCondition>('average')
const counts = ref({ light: 0, heavy: 0, motorcycle: 0, bicycle: 0 })
const status = ref<'loading' | 'ready' | 'error'>('loading')
const message = ref('')
const saving = ref(false)
const selectedCamera = computed(() => cameras.value.find((camera) => camera.id === selectedCameraId.value) ?? null)
const latest = computed(() => observations.value[0] ?? null)
const conditionLabel = (value: TrafficCondition | null | undefined) => value ? value.charAt(0).toUpperCase() + value.slice(1) : 'No Data'

async function load(): Promise<void> {
  if (!supabaseClient || authSession.state.status !== 'authenticated') {
    status.value = 'error'
    message.value = 'Sign in with an authorized CCTV-management account to view observations.'
    return
  }
  status.value = 'loading'
  message.value = ''
  try {
    cameras.value = await listCctvLocations(supabaseClient)
    if (!selectedCameraId.value || !cameras.value.some((camera) => camera.id === selectedCameraId.value)) selectedCameraId.value = cameras.value[0]?.id ?? ''
    await loadHistory()
    status.value = 'ready'
  } catch (error) {
    status.value = 'error'
    message.value = error instanceof Error ? error.message : 'Traffic observations could not be loaded.'
  }
}

async function loadHistory(): Promise<void> {
  if (!supabaseClient || !selectedCameraId.value) {
    observations.value = []
    return
  }
  observations.value = await listTrafficObservations(supabaseClient, selectedCameraId.value)
}

async function refreshHistory(): Promise<void> {
  message.value = ''
  try {
    await loadHistory()
  } catch (error) {
    observations.value = []
    message.value = error instanceof Error ? error.message : 'Traffic observations could not be loaded.'
  }
}

async function saveObservation(): Promise<void> {
  if (!supabaseClient || !selectedCameraId.value || saving.value) return
  const input: ManualObservationInput = {
    cctvId: selectedCameraId.value,
    condition: condition.value,
    lightVehicleCount: counts.value.light,
    heavyVehicleCount: counts.value.heavy,
    motorcycleCount: counts.value.motorcycle,
    bicycleCount: counts.value.bicycle,
  }
  saving.value = true
  message.value = ''
  try {
    await createManualTrafficObservation(supabaseClient, input)
    message.value = 'Manual traffic observation saved.'
    try {
      await loadHistory()
    } catch {
      message.value = 'Observation saved, but its history could not be refreshed. Reload the page to check it.'
    }
  } catch (error) {
    message.value = error instanceof Error ? error.message : 'Traffic observation could not be saved.'
  } finally {
    saving.value = false
  }
}

onMounted(() => { void load() })
</script>

<template>
  <div class="legacy-analysis">
    <section class="legacy-video-column" aria-label="CCTV video workspace">
      <div class="legacy-video-stage" role="img" aria-label="Video analysis is unavailable">
        <div class="legacy-video-stage__message">
          <span class="legacy-video-stage__icon" aria-hidden="true">▶</span>
          <strong>{{ selectedCamera?.name ?? 'No CCTV selected' }}</strong>
          <span>Video source access and computer-vision processing are not connected.</span>
        </div>
      </div>
      <div class="legacy-video-actions">
        <label for="observation-camera">CCTV</label>
        <select id="observation-camera" v-model="selectedCameraId" :disabled="status !== 'ready'" @change="refreshHistory">
          <option value="">Select CCTV</option>
          <option v-for="camera in cameras" :key="camera.id" :value="camera.id">{{ camera.name }} · {{ camera.agencyName }}</option>
        </select>
      </div>
      <div class="legacy-observation-note">Manual records cover the five minutes before saving. They are labeled as manual and are not video-derived.</div>
      <form v-if="selectedCamera" class="legacy-manual-observation" @submit.prevent="saveObservation">
        <label for="traffic-condition">Traffic condition</label>
        <select id="traffic-condition" v-model="condition">
          <option value="terrible">Terrible</option><option value="bad">Bad</option><option value="poor">Poor</option>
          <option value="average">Average</option><option value="good">Good</option><option value="great">Great</option>
        </select>
        <label>Vehicle counts</label>
        <div class="legacy-manual-observation__counts">
          <label>LV <input v-model.number="counts.light" type="number" min="0" max="1000000" step="1"></label>
          <label>HV <input v-model.number="counts.heavy" type="number" min="0" max="1000000" step="1"></label>
          <label>MC <input v-model.number="counts.motorcycle" type="number" min="0" max="1000000" step="1"></label>
          <label>Bicycle <input v-model.number="counts.bicycle" type="number" min="0" max="1000000" step="1"></label>
        </div>
        <button class="legacy-button legacy-button--primary" type="submit" :disabled="saving">{{ saving ? 'Saving…' : 'Save Manual Observation' }}</button>
      </form>
      <p v-if="message" role="status">{{ message }}</p>
      <button v-if="status === 'error'" class="legacy-button legacy-button--outline" type="button" @click="load">Retry</button>
    </section>

    <aside class="legacy-analysis-summary" aria-label="Traffic observation summary">
      <div class="legacy-analysis-summary__heading">
        <h2>{{ selectedCamera?.name ?? 'Camera not selected' }}</h2>
        <span class="legacy-state-tag">{{ conditionLabel(latest?.condition) }}</span>
      </div>
      <p v-if="status === 'loading'" role="status">Loading observations…</p>
      <p v-else-if="status === 'error'" role="alert">{{ message }}</p>
      <template v-else-if="latest">
        <article v-for="[label, count] in [['Light Vehicle (LV)', latest.lightVehicleCount], ['Heavy Vehicle (HV)', latest.heavyVehicleCount], ['Motorcycle (MC)', latest.motorcycleCount], ['Bicycle', latest.bicycleCount]]" :key="label" class="legacy-vehicle-card">
          <div><h3>{{ label }}</h3><strong>{{ count }}</strong><p>{{ latest.sourceKind === 'manual' ? 'Manual observation' : 'Processed observation' }}</p></div>
        </article>
        <p>Observed {{ new Date(latest.windowEndedAt).toLocaleString() }} · {{ latest.countingMethod.replaceAll('_', ' ') }}</p>
      </template>
      <p v-else>No Data — no persisted observations for this CCTV.</p>
      <section class="legacy-observation-history" aria-label="Observation history">
        <h3>Observation History</h3>
        <ul><li v-for="item in observations" :key="item.id">{{ new Date(item.windowEndedAt).toLocaleString() }} · {{ conditionLabel(item.condition) }} · {{ item.sourceKind === 'manual' ? 'Manual' : 'Processed' }}</li></ul>
      </section>
    </aside>
  </div>
</template>
