<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { authSession } from '../auth/session'
import TrafficMap from '../components/map/TrafficMap.vue'
import TrafficAnalysisConfig from '../components/cctv/TrafficAnalysisConfig.vue'
import { getCctvDemoAssociation, saveCctvDemoVideo, type TrafficDemoId } from '../data/cctvDemoVideo'
import type { LiveDemoStream } from '../data/liveDemoStreams'
import { trafficDemoVideos } from '../data/trafficDemo'
import { createCctvLocation, getCctvLocation, getCctvSnapshotUrl, listCctvAgencies, replaceCctvSnapshot, updateCctvLocation, validateCctvLocationInput, type CctvAgencyOption, type CctvLocationInput } from '../data/cctvManagement'
import { validateImage } from '../data/privateMedia'
import { appConfig } from '../config/app'
import { parseCoordinate } from '../domain/coordinates'
import { supabaseClient } from '../lib/supabase'
import { isWithinBoundary, loadBoundary, type BoundaryFeatureCollection } from '../map/boundary'

const route = useRoute()
const router = useRouter()
const editingId = typeof route.params.id === 'string' ? route.params.id : null
const editing = editingId !== null
const title = editing ? 'Edit CCTV' : 'Add New CCTV'
const agencies = ref<readonly CctvAgencyOption[]>([])
const boundary = ref<BoundaryFeatureCollection | null>(null)
const loading = ref(true)
const formAvailable = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const selectedImage = ref<File | null>(null)
const imagePreview = ref<string | null>(null)
const savedImageUrl = ref<string | null>(null)
const snapshotPath = ref<string | null>(null)
const demoVideoId = ref<TrafficDemoId | null>(null)
const originalDemoVideoId = ref<TrafficDemoId | null>(null)
const demoVideoEditable = ref(true)
const liveDemoStream = ref<LiveDemoStream | null>(null)
const createdId = ref<string | null>(null)
const form = reactive({ name: '', address: '', category: 'regular' as 'regular' | 'analytic', agencyId: '', longitude: '', latitude: '' })
const allowedAgencyIds = computed(() => agencies.value.map(({ id }) => id))
const locationCoordinates = computed<[number, number] | null>(() => {
  const longitude = parseCoordinate(form.longitude)
  const latitude = parseCoordinate(form.latitude)
  return longitude !== null && latitude !== null && longitude >= -180 && longitude <= 180 && latitude >= -90 && latitude <= 90
    ? [longitude, latitude]
    : null
})
const selectedDemoVideo = computed(() => trafficDemoVideos.find(({ id }) => id === demoVideoId.value) ?? null)
let controller: AbortController | null = null
let accessRevision = 0
let loaded = false
let accessKey = `${authSession.state.user?.id ?? ''}:${authSession.state.role ?? ''}:${authSession.state.agencyIds.join(',')}`

const locationWarning = computed(() => {
  if (!boundary.value || !locationCoordinates.value) return ''
  const [longitude, latitude] = locationCoordinates.value
  return isWithinBoundary(boundary.value, longitude, latitude) ? '' : 'This point is outside the Banda Aceh administrative boundary. Confirm the coordinates before saving.'
})

function currentAuthStatus(): string {
  return authSession.state.status
}

onMounted(() => { void loadForm() })

watch(
  () => authSession.state.status,
  (status) => {
    if (status === 'loading') {
      loading.value = true
      controller?.abort()
      return
    }
    if (status !== 'authenticated') {
      accessRevision += 1
      loaded = false
      formAvailable.value = false
      controller?.abort()
      agencies.value = []
      Object.assign(form, { name: '', address: '', category: 'regular', agencyId: '', longitude: '', latitude: '' })
      void router.replace({ name: 'login', query: { redirect: route.fullPath } })
      return
    }
    const nextAccessKey = `${authSession.state.user?.id ?? ''}:${authSession.state.role ?? ''}:${authSession.state.agencyIds.join(',')}`
    if (nextAccessKey !== accessKey) {
      accessRevision += 1
      loaded = false
      formAvailable.value = false
      agencies.value = []
      Object.assign(form, { name: '', address: '', category: 'regular', agencyId: '', longitude: '', latitude: '' })
      accessKey = nextAccessKey
    }
    if (!loaded) void loadForm()
    else loading.value = false
  },
)

async function loadForm(): Promise<void> {
  controller?.abort()
  loading.value = true
  errorMessage.value = ''
  if (!supabaseClient) {
    loading.value = false
    errorMessage.value = 'Supabase is not configured.'
    return
  }
  const current = new AbortController()
  controller = current
  try {
    const [agencyRows, adminBoundary] = await Promise.all([
      listCctvAgencies(supabaseClient, authSession.state.role, authSession.state.agencyIds),
      loadBoundary(appConfig.map.boundaryUrl, current.signal).catch(() => null),
    ])
    if (current.signal.aborted) return
    agencies.value = agencyRows
    boundary.value = adminBoundary
    if (editingId) {
      const location = await getCctvLocation(supabaseClient, editingId, current.signal)
      if (current.signal.aborted) return
      if (!location) {
        errorMessage.value = 'This CCTV record was not found or is no longer accessible.'
        return
      }
      if (!agencyRows.some(({ id }) => id === location.agencyId)) {
        errorMessage.value = 'You do not have permission to edit this agency’s camera.'
        return
      }
      Object.assign(form, {
        name: location.name,
        address: location.address,
        category: location.category,
        agencyId: location.agencyId,
        longitude: String(location.longitude),
        latitude: String(location.latitude),
      })
      snapshotPath.value = location.snapshotPath
      savedImageUrl.value = appConfig.privateMediaEnabled ? await getCctvSnapshotUrl(supabaseClient, location.snapshotPath).catch(() => null) : null
      const videoAssociation = await getCctvDemoAssociation(supabaseClient, editingId)
      liveDemoStream.value = videoAssociation.liveStream
      demoVideoId.value = videoAssociation.video?.id ?? null
      originalDemoVideoId.value = demoVideoId.value
      demoVideoEditable.value = videoAssociation.editable
    }
    formAvailable.value = true
  } catch (error) {
    if (current.signal.aborted) return
    errorMessage.value = error instanceof Error ? error.message : 'CCTV form data could not be loaded.'
  } finally {
    if (!current.signal.aborted) {
      loaded = true
      loading.value = false
    }
  }
}

function input(): CctvLocationInput {
  return {
    name: form.name,
    address: form.address,
    category: form.category,
    agencyId: form.agencyId,
    longitude: parseCoordinate(form.longitude) ?? Number.NaN,
    latitude: parseCoordinate(form.latitude) ?? Number.NaN,
  }
}

async function submit(): Promise<void> {
  if (currentAuthStatus() !== 'authenticated' || !supabaseClient || saving.value) return
  errorMessage.value = ''
  successMessage.value = ''
  const value = input()
  const validation = validateCctvLocationInput(value, allowedAgencyIds.value)
  if (validation) {
    errorMessage.value = validation
    return
  }
  if (demoVideoId.value && !/\b(test|demo|qa)\b/i.test(form.name)) {
    errorMessage.value = 'Licensed demo footage can only be associated with a CCTV clearly identified as QA or demo.'
    return
  }
  const revision = accessRevision
  const userId = authSession.state.user?.id
  let metadataSaved = false
  let savingAssociation = false
  saving.value = true
  try {
    if (selectedImage.value && !appConfig.privateMediaEnabled) throw new Error('CCTV image storage is not enabled for this deployment.')
    const existingId = editingId ?? createdId.value
    const cameraId = existingId
      ? (await updateCctvLocation(supabaseClient, existingId, value)) ? existingId : null
      : await createCctvLocation(supabaseClient, value)
    if (currentAuthStatus() === 'loading') {
      await new Promise<void>((resolve) => {
        const stop = watch(() => authSession.state.status, (nextStatus) => {
          if (nextStatus !== 'loading') {
            stop()
            resolve()
          }
        })
      })
    }
    if (revision !== accessRevision || currentAuthStatus() !== 'authenticated' || authSession.state.user?.id !== userId) return
    if (!cameraId) throw new Error('No record was changed. It may have been removed or you may no longer have access.')
    metadataSaved = true
    if (!editingId) createdId.value = cameraId
    if (selectedImage.value) {
      const image = await replaceCctvSnapshot(supabaseClient, cameraId, snapshotPath.value, selectedImage.value)
      snapshotPath.value = image.path
      savedImageUrl.value = image.url
      selectedImage.value = null
      if (imagePreview.value) URL.revokeObjectURL(imagePreview.value)
      imagePreview.value = null
    }
    if (demoVideoEditable.value && (form.category === 'analytic' || demoVideoId.value !== originalDemoVideoId.value)) {
      savingAssociation = true
      await saveCctvDemoVideo(supabaseClient, cameraId, userId ?? '', demoVideoId.value)
      savingAssociation = false
      originalDemoVideoId.value = demoVideoId.value
    }
    successMessage.value = editing ? 'CCTV location updated.' : 'CCTV location created. It is private on the public map until publication is approved.'
    await router.replace({ path: '/cctv', query: { saved: editing ? 'updated' : 'created' } })
  } catch (error) {
    if (revision === accessRevision) {
      const message = error instanceof Error ? error.message : 'CCTV record could not be saved.'
      errorMessage.value = savingAssociation
        ? `CCTV details were saved, but the video association could not be saved. ${message} Your selections remain available; retry after resolving the association permission.`
        : metadataSaved && selectedImage.value
        ? `CCTV metadata was saved, but its image was not. ${message} Retry to attach the image without creating another camera.`
        : message
    }
  } finally {
    saving.value = false
  }
}

async function chooseImage(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null
  errorMessage.value = ''
  if (imagePreview.value) URL.revokeObjectURL(imagePreview.value)
  imagePreview.value = null
  selectedImage.value = null
  if (!file) return
  try {
    await validateImage(file, 5 * 1024 * 1024)
    selectedImage.value = file
    imagePreview.value = URL.createObjectURL(file)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Choose a valid image.'
    ;(event.target as HTMLInputElement).value = ''
  }
}

function setCoordinates(coordinates: [number, number]): void {
  form.longitude = coordinates[0].toFixed(6)
  form.latitude = coordinates[1].toFixed(6)
}

onBeforeUnmount(() => {
  controller?.abort()
  if (imagePreview.value) URL.revokeObjectURL(imagePreview.value)
})
</script>

<template>
  <section class="cctv-form-card" :aria-labelledby="'cctv-form-title'">
    <header class="cctv-form-card__heading"><h2 id="cctv-form-title">{{ title }}</h2><RouterLink class="legacy-button legacy-button--outline" to="/cctv">Cancel</RouterLink></header>
    <p v-if="loading" role="status" class="cctv-form-feedback">Loading CCTV details…</p>
    <p v-if="errorMessage" role="alert" class="cctv-form-feedback cctv-form-feedback--error">{{ errorMessage }}</p>
    <p v-if="successMessage" role="status" class="cctv-form-feedback">{{ successMessage }}</p>
    <p v-if="!loading && agencies.length === 0" class="cctv-form-feedback" role="status">No agency is available for your account. Ask an administrator to configure an authorized agency before adding or editing camera metadata.</p>

    <form v-if="!loading && formAvailable" class="cctv-form-layout" @submit.prevent="submit">
      <div class="cctv-form-fields">
        <label for="cctv-name">Name</label>
        <input id="cctv-name" v-model="form.name" class="legacy-input" required minlength="2" maxlength="160" autocomplete="off" />
        <label for="cctv-category">Category</label>
        <select id="cctv-category" v-model="form.category" class="legacy-select"><option value="regular">Regular</option><option value="analytic">Analytic</option></select>
        <label for="cctv-address">Address</label>
        <input id="cctv-address" v-model="form.address" class="legacy-input" required minlength="2" maxlength="500" autocomplete="street-address" />
        <div class="cctv-form-coordinates">
          <div><label for="cctv-latitude">Latitude (N)</label><input id="cctv-latitude" v-model="form.latitude" class="legacy-input" type="text" inputmode="decimal" autocomplete="off" required /></div>
          <div><label for="cctv-longitude">Longitude (E)</label><input id="cctv-longitude" v-model="form.longitude" class="legacy-input" type="text" inputmode="decimal" autocomplete="off" required /></div>
        </div>
        <p v-if="locationWarning" class="cctv-form-feedback cctv-form-feedback--warning" role="status">{{ locationWarning }}</p>
        <label for="cctv-agency">Agency</label>
        <select id="cctv-agency" v-model="form.agencyId" class="legacy-select" required :disabled="agencies.length === 0"><option value="" disabled>Select</option><option v-for="agency in agencies" :key="agency.id" :value="agency.id">{{ agency.name }}</option></select>
        <label for="cctv-image">Image</label>
        <img v-if="imagePreview || savedImageUrl" class="cctv-image-preview" :src="imagePreview || savedImageUrl || ''" alt="CCTV image preview">
        <input id="cctv-image" class="legacy-input" type="file" accept="image/jpeg,image/png,image/webp" :disabled="saving || !appConfig.privateMediaEnabled" aria-describedby="cctv-image-note" @change="chooseImage">
        <p id="cctv-image-note" class="cctv-form-note">{{ appConfig.privateMediaEnabled ? 'Private JPEG, PNG, or WebP image; maximum 5 MB. Only authorized agency managers can access it.' : 'Image upload is unavailable until the private Storage migration is approved and applied.' }}</p>
        <template v-if="form.category === 'analytic' && liveDemoStream">
          <p class="cctv-form-note">LIVE STREAM DEMO — {{ liveDemoStream.city }} · {{ liveDemoStream.title }}. This public stream is shown for demonstration only; it is not this camera’s live feed or mapped location. <a :href="liveDemoStream.sourceUrl" target="_blank" rel="noreferrer">Open official YouTube stream</a>.</p>
        </template>
        <template v-else-if="form.category === 'analytic'">
          <label for="cctv-demo-video">Analytic / Video Source</label>
          <select id="cctv-demo-video" v-model="demoVideoId" class="legacy-select" :disabled="saving || !demoVideoEditable">
            <option :value="null">No video — use uploaded image</option>
            <option v-for="video in trafficDemoVideos" :key="video.id" :value="video.id">{{ video.title }} — DEMO VIDEO, NOT LIVE CCTV</option>
          </select>
          <p id="cctv-url-note" class="cctv-form-note">
            Only the two licensed local demo clips are selectable for a clearly named QA/demo camera. The footage does not depict this camera location; private stream URLs and credentials are not accepted.
            <template v-if="demoVideoId"> Source: {{ trafficDemoVideos.find((video) => video.id === demoVideoId)?.creator }} · <a :href="trafficDemoVideos.find((video) => video.id === demoVideoId)?.sourceUrl" target="_blank" rel="noreferrer">Pexels source</a>.</template>
            <template v-if="!demoVideoEditable"> This camera has a separate private video configuration that this form cannot change.</template>
          </p>
        </template>
        <TrafficAnalysisConfig
          v-if="editingId && appConfig.roiDensityEnabled && !liveDemoStream"
          :camera-id="editingId"
          :video="form.category === 'analytic' ? selectedDemoVideo : null"
          :editable="demoVideoEditable && agencies.some(({ id }) => id === form.agencyId)"
        />
        <p class="cctv-form-note">Camera stream credentials and URLs are managed separately and are not part of this form. New camera locations remain private on the public map by default.</p>
        <div class="cctv-form-actions"><RouterLink class="legacy-button legacy-button--outline" to="/cctv">Cancel</RouterLink><button class="legacy-button legacy-button--primary" type="submit" :disabled="saving || agencies.length === 0">{{ saving ? 'Saving…' : 'Submit' }}</button></div>
      </div>
      <div class="cctv-form-map"><h3>Select location</h3><p>Click the map to fill longitude and latitude, or enter coordinates above.</p><TrafficMap compact location-picker :location-coordinates="locationCoordinates" @location-selected="setCoordinates" /></div>
    </form>
  </section>
</template>
