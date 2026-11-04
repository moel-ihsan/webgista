<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'

import { authSession } from '../auth/session'
import TrafficMap from '../components/map/TrafficMap.vue'
import { appConfig } from '../config/app'
import { createAgency, deleteAgency, listAgencies, type Agency } from '../data/agencies'
import { DEFAULT_MAP_VIEWPORT, loadMapViewport, saveMapViewport, validateMapViewport, type MapViewport } from '../data/mapSettings'
import { parseCoordinate } from '../domain/coordinates'
import { supabaseClient } from '../lib/supabase'

const form = reactive({
  latitude: String(DEFAULT_MAP_VIEWPORT.latitude),
  longitude: String(DEFAULT_MAP_VIEWPORT.longitude),
  zoom: String(DEFAULT_MAP_VIEWPORT.zoom),
})
const agencies = ref<readonly Agency[]>([])
const loading = ref(true)
const saving = ref(false)
const addingAgency = ref(false)
const removingAgencyId = ref<string | null>(null)
const inputVisible = ref(false)
const agencyName = ref('')
const errorMessage = ref('')
const successMessage = ref('')
const agencyError = ref('')
const agencySuccess = ref('')

const previewViewport = computed<MapViewport | null>(() => {
  const latitude = parseCoordinate(form.latitude)
  const longitude = parseCoordinate(form.longitude)
  const zoom = parseCoordinate(form.zoom)
  if (latitude === null || longitude === null || zoom === null) return null
  const viewport = { latitude, longitude, zoom }
  return validateMapViewport(viewport) ? null : viewport
})

onMounted(() => { void loadSettings() })

async function loadSettings(): Promise<void> {
  loading.value = true
  errorMessage.value = ''
  agencyError.value = ''
  if (!supabaseClient) {
    loading.value = false
    errorMessage.value = 'Supabase is not configured.'
    return
  }

  const [settingsResult, agenciesResult] = await Promise.allSettled([
    loadMapViewport(supabaseClient),
    listAgencies(supabaseClient, authSession.state.role, authSession.state.agencyIds),
  ])
  if (settingsResult.status === 'fulfilled') {
    const viewport = settingsResult.value ?? DEFAULT_MAP_VIEWPORT
    form.latitude = String(viewport.latitude)
    form.longitude = String(viewport.longitude)
    form.zoom = String(viewport.zoom)
  } else {
    errorMessage.value = 'Saved map settings could not be loaded. The map preview is using the Banda Aceh fallback.'
  }
  if (agenciesResult.status === 'fulfilled') agencies.value = agenciesResult.value
  else agencyError.value = 'Agency list could not be loaded.'
  loading.value = false
}

function updateForm(viewport: MapViewport): void {
  form.latitude = viewport.latitude.toFixed(6)
  form.longitude = viewport.longitude.toFixed(6)
  form.zoom = viewport.zoom.toFixed(2).replace(/\.00$/, '')
}

async function submitSettings(): Promise<void> {
  if (saving.value || authSession.state.role !== 'administrator') return
  errorMessage.value = ''
  successMessage.value = ''
  if (!supabaseClient) {
    errorMessage.value = 'Supabase is not configured.'
    return
  }
  const latitude = parseCoordinate(form.latitude)
  const longitude = parseCoordinate(form.longitude)
  const zoom = parseCoordinate(form.zoom)
  if (latitude === null || longitude === null || zoom === null) {
    errorMessage.value = 'Enter valid latitude, longitude, and zoom values.'
    return
  }
  const viewport = { latitude, longitude, zoom }
  const validation = validateMapViewport(viewport)
  if (validation) {
    errorMessage.value = validation
    return
  }

  saving.value = true
  try {
    const saved = await saveMapViewport(supabaseClient, viewport)
    updateForm(saved)
    successMessage.value = 'Default map center and zoom saved.'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Map settings could not be saved.'
  } finally {
    saving.value = false
  }
}

async function addAgency(): Promise<void> {
  if (addingAgency.value || authSession.state.role !== 'administrator') return
  agencyError.value = ''
  agencySuccess.value = ''
  if (!supabaseClient) {
    agencyError.value = 'Supabase is not configured.'
    return
  }
  addingAgency.value = true
  try {
    const agency = await createAgency(supabaseClient, agencyName.value)
    agencies.value = [...agencies.value, agency].sort((left, right) => left.name.localeCompare(right.name))
    agencyName.value = ''
    inputVisible.value = false
    agencySuccess.value = `${agency.name} added as a private agency.`
  } catch (error) {
    agencyError.value = error instanceof Error ? error.message : 'Agency could not be added.'
  } finally {
    addingAgency.value = false
  }
}

function confirmAgencyInput(): void {
  if (!agencyName.value.trim()) {
    inputVisible.value = false
    return
  }
  void addAgency()
}

async function removeAgency(agency: Agency): Promise<void> {
  if (removingAgencyId.value || authSession.state.role !== 'administrator' || !supabaseClient) return
  agencyError.value = ''
  agencySuccess.value = ''
  removingAgencyId.value = agency.id
  try {
    if (!await deleteAgency(supabaseClient, agency.id)) throw new Error('Agency was not removed; refresh the list and check access.')
    agencies.value = agencies.value.filter(({ id }) => id !== agency.id)
    agencySuccess.value = `${agency.name} removed.`
  } catch (error) {
    agencyError.value = error instanceof Error ? error.message : 'Agency could not be removed.'
  } finally {
    removingAgencyId.value = null
  }
}
</script>

<template>
  <div class="legacy-settings">
    <section class="legacy-settings__form" aria-labelledby="settings-map-title">
      <div class="legacy-settings__fields">
        <h2 id="settings-map-title">Center The Map</h2>
        <p v-if="loading" class="legacy-unavailable" role="status">Loading saved map settings…</p>
        <p v-else-if="!errorMessage && previewViewport" class="legacy-unavailable">Application-wide default map view</p>

        <label for="setting-latitude">Latitude (N)</label>
        <input id="setting-latitude" v-model="form.latitude" class="legacy-input" type="text" inputmode="decimal" :disabled="loading || saving" />

        <label for="setting-longitude">Longitude (E)</label>
        <input id="setting-longitude" v-model="form.longitude" class="legacy-input" type="text" inputmode="decimal" :disabled="loading || saving" />

        <label for="setting-zoom">Zoom (8–18)</label>
        <input id="setting-zoom" v-model="form.zoom" class="legacy-input" type="text" inputmode="decimal" :disabled="loading || saving" />

        <p v-if="errorMessage" class="legacy-settings__feedback legacy-settings__feedback--error" role="alert">{{ errorMessage }}</p>
        <p v-if="successMessage" class="legacy-settings__feedback legacy-settings__feedback--success" role="status">{{ successMessage }}</p>
        <button class="legacy-button legacy-button--primary" type="button" :disabled="loading || saving" @click="submitSettings">
          {{ saving ? 'Saving…' : 'Submit' }}
        </button>
      </div>

      <div class="legacy-settings__agencies">
        <h2>Add Agency List</h2>
        <p v-if="agencies.length === 0 && !agencyError" class="legacy-unavailable">No registered agencies.</p>
        <div class="legacy-agency-tags" aria-label="Registered agencies">
          <span v-for="agency in agencies" :key="agency.id" class="legacy-agency-tag">
            <span>{{ agency.name }}</span>
            <small>{{ agency.isPublic ? 'Public' : 'Private' }}</small>
            <button v-if="appConfig.agencyRemovalEnabled" type="button" :aria-label="`Remove ${agency.name}`" :disabled="removingAgencyId !== null" @click="removeAgency(agency)">×</button>
          </span>
          <form v-if="inputVisible" class="legacy-agency-new" @submit.prevent="addAgency">
            <input v-model="agencyName" class="legacy-input" type="text" maxlength="120" minlength="2" placeholder="Agency name" aria-label="New agency name" :disabled="addingAgency" autofocus @blur="confirmAgencyInput" />
            <button class="legacy-button legacy-button--outline" type="submit" :disabled="addingAgency">{{ addingAgency ? 'Adding…' : 'Add' }}</button>
          </form>
          <button v-else class="legacy-button legacy-button--outline" type="button" @click="inputVisible = true">＋ New Tag</button>
        </div>
        <p v-if="agencies.length && !appConfig.agencyRemovalEnabled" class="legacy-unavailable">Agency removal is disabled until the membership-protection migration is deployed.</p>
        <p v-if="agencyError" class="legacy-settings__feedback legacy-settings__feedback--error" role="alert">{{ agencyError }}</p>
        <p v-if="agencySuccess" class="legacy-settings__feedback legacy-settings__feedback--success" role="status">{{ agencySuccess }}</p>
      </div>

      <div class="legacy-settings__categories">
        <h2>Traffic Condition</h2>
        <div class="legacy-category-tags">
          <span>Terrible</span><span>Bad</span><span>Poor</span><span>Average</span>
          <span>Good</span><span>Great</span><span>No Data</span>
        </div>
      </div>

      <p class="legacy-settings__provider">
        Basemaps are available from Map View.
      </p>
    </section>

    <section class="legacy-settings__map" aria-label="Map preview">
      <TrafficMap compact map-center-picker :viewport="previewViewport" @viewport-changed="updateForm" />
      <p class="legacy-settings__map-note">Click the map to set its center. Scroll to change zoom.</p>
    </section>
  </div>
</template>
