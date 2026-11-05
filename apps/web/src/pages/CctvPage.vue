<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { authSession } from '../auth/session'
import { deleteCctvLocation, listCctvAgencies, listCctvLocations, canManageCctvLocation, pageCctvLocations, searchCctvLocations, setCctvLocationActive, sortCctvLocations, type CctvManagementLocation, type CctvSortField } from '../data/cctvManagement'
import { removePrivateImage } from '../data/privateMedia'
import { supabaseClient } from '../lib/supabase'

const route = useRoute()
const router = useRouter()
const locations = ref<readonly CctvManagementLocation[]>([])
const agencyCount = ref(0)
const search = ref('')
const pageSize = ref(5)
const page = ref(1)
const selectedId = ref<string | null>(null)
const sortField = ref<CctvSortField>('name')
const sortDirection = ref<'ascending' | 'descending'>('ascending')
const status = ref<'loading' | 'ready' | 'error'>('loading')
const errorMessage = ref('')
const mutationMessage = ref(route.query.saved === 'created' ? 'CCTV location created.' : route.query.saved === 'updated' ? 'CCTV location updated.' : '')
const busyId = ref<string | null>(null)
let controller: AbortController | null = null
let accessRevision = 0

const filteredLocations = computed(() => searchCctvLocations(locations.value, search.value))
const sortedLocations = computed(() => sortCctvLocations(filteredLocations.value, sortField.value, sortDirection.value))
const pageCount = computed(() => Math.max(1, Math.ceil(sortedLocations.value.length / pageSize.value)))
const visibleLocations = computed(() => pageCctvLocations(sortedLocations.value, page.value, pageSize.value))
const firstEntry = computed(() => filteredLocations.value.length ? (page.value - 1) * pageSize.value + 1 : 0)
const lastEntry = computed(() => Math.min(page.value * pageSize.value, filteredLocations.value.length))
const canAdd = computed(() => agencyCount.value > 0 && (authSession.state.role === 'administrator' || authSession.state.role === 'agency_editor'))

watch([search, pageSize], () => { page.value = 1 })
watch(() => authSession.state.status, async (authStatus) => {
  accessRevision += 1
  controller?.abort()
  controller = null
  if (authStatus !== 'authenticated') {
    locations.value = []
    agencyCount.value = 0
    busyId.value = null
    mutationMessage.value = ''
    status.value = authStatus === 'loading' ? 'loading' : 'ready'
    if (authStatus !== 'loading') void router.replace({ name: 'login', query: { redirect: route.fullPath } })
    return
  }
  await refresh()
}, { immediate: true })

async function refresh(): Promise<void> {
  if (authSession.state.status !== 'authenticated') return
  controller?.abort()
  const current = new AbortController()
  controller = current
  status.value = 'loading'
  errorMessage.value = ''
  if (!supabaseClient) {
    status.value = 'error'
    errorMessage.value = 'Supabase is not configured.'
    return
  }
  try {
    const [rows, agencies] = await Promise.all([
      listCctvLocations(supabaseClient, current.signal),
      listCctvAgencies(supabaseClient, authSession.state.role, authSession.state.agencyIds),
    ])
    if (current.signal.aborted) return
    locations.value = rows
    agencyCount.value = agencies.length
    status.value = 'ready'
  } catch {
    if (current.signal.aborted) return
    locations.value = []
    status.value = 'error'
    errorMessage.value = 'CCTV records could not be loaded. Check your connection and access.'
  }
}

async function changeActive(location: CctvManagementLocation): Promise<void> {
  if (authSession.state.status !== 'authenticated' || !supabaseClient || busyId.value) return
  if (location.isActive && !window.confirm(`Deactivate “${location.name}”?`)) return
  const revision = accessRevision
  busyId.value = location.id
  mutationMessage.value = ''
  try {
    const changed = await setCctvLocationActive(supabaseClient, location.id, !location.isActive)
    if (revision !== accessRevision) return
    if (!changed) throw new Error('The record was not changed or is no longer accessible.')
    mutationMessage.value = `“${location.name}” ${location.isActive ? 'deactivated' : 'activated'}.`
    await refresh()
  } catch (error) {
    if (revision === accessRevision) mutationMessage.value = error instanceof Error ? error.message : 'Status could not be changed.'
  } finally {
    if (revision === accessRevision) busyId.value = null
  }
}

async function removeLocation(location: CctvManagementLocation): Promise<void> {
  if (authSession.state.status !== 'authenticated' || authSession.state.role !== 'administrator' || !supabaseClient || busyId.value) return
  if (!window.confirm(`Permanently delete “${location.name}”? This cannot be undone.`)) return
  const revision = accessRevision
  busyId.value = location.id
  mutationMessage.value = ''
  try {
    const deleted = await deleteCctvLocation(supabaseClient, location.id)
    if (revision !== accessRevision) return
    if (!deleted) throw new Error('The record was not deleted or is no longer accessible.')
    mutationMessage.value = `“${location.name}” deleted.`
    await refresh()
    if (location.snapshotPath) {
      try {
        await removePrivateImage(supabaseClient, 'cctv-images', location.snapshotPath)
      } catch {
        mutationMessage.value = `“${location.name}” was deleted, but its image could not be cleaned up from private storage.`
      }
    }
  } catch (error) {
    if (revision === accessRevision) mutationMessage.value = error instanceof Error ? error.message : 'CCTV record could not be deleted.'
  } finally {
    if (revision === accessRevision) busyId.value = null
  }
}

function canManage(location: CctvManagementLocation): boolean {
  return canManageCctvLocation(authSession.state.role, authSession.state.agencyIds, location)
}

function sortBy(field: CctvSortField): void {
  if (sortField.value === field) sortDirection.value = sortDirection.value === 'ascending' ? 'descending' : 'ascending'
  else {
    sortField.value = field
    sortDirection.value = 'ascending'
  }
  page.value = 1
}

onBeforeUnmount(() => {
  accessRevision += 1
  controller?.abort()
})
</script>

<template>
  <section class="legacy-table-panel" aria-label="CCTV data table">
    <div class="legacy-table-controls">
      <label class="visually-hidden" for="page-size">Rows per page</label>
      <select id="page-size" v-model.number="pageSize" class="legacy-select">
        <option :value="5">5</option><option :value="10">10</option><option :value="20">20</option><option :value="50">50</option>
      </select>
      <label class="visually-hidden" for="cctv-search">Search CCTV records</label>
      <input id="cctv-search" v-model="search" class="legacy-input legacy-search" type="search" placeholder="Type to search" />
    </div>

    <p v-if="mutationMessage" class="cctv-management-message" role="status">{{ mutationMessage }}</p>
    <p v-if="status === 'error'" class="cctv-management-error" role="alert">
      {{ errorMessage }} <button class="legacy-button legacy-button--outline" type="button" @click="refresh">Retry</button>
    </p>

    <div class="legacy-table-scroll">
      <table class="legacy-table">
        <thead><tr>
          <th scope="col" :aria-sort="sortField === 'name' ? sortDirection : 'none'"><button class="cctv-sort-button" type="button" @click="sortBy('name')">Name</button></th>
          <th scope="col" :aria-sort="sortField === 'address' ? sortDirection : 'none'"><button class="cctv-sort-button" type="button" @click="sortBy('address')">Address</button></th>
          <th scope="col" :aria-sort="sortField === 'coordinate' ? sortDirection : 'none'"><button class="cctv-sort-button" type="button" @click="sortBy('coordinate')">Coordinate</button></th>
          <th scope="col" :aria-sort="sortField === 'agency' ? sortDirection : 'none'"><button class="cctv-sort-button" type="button" @click="sortBy('agency')">Agency</button></th>
          <th scope="col" :aria-sort="sortField === 'category' ? sortDirection : 'none'"><button class="cctv-sort-button" type="button" @click="sortBy('category')">Status</button></th><th scope="col" class="legacy-table__actions">
            <RouterLink v-if="canAdd" class="legacy-button legacy-button--outline" to="/cctv/new"><span aria-hidden="true">＋</span> Add New</RouterLink>
          </th>
        </tr></thead>
        <tbody>
          <tr v-if="status === 'loading'"><td colspan="6" class="legacy-table__empty" role="status">Loading CCTV records…</td></tr>
          <tr v-else-if="status === 'error'"><td colspan="6" class="legacy-table__empty">CCTV records are unavailable.</td></tr>
          <tr v-else-if="filteredLocations.length === 0"><td colspan="6" class="legacy-table__empty">
            <strong>{{ search ? 'No matching CCTV records.' : 'No CCTV records are available.' }}</strong>
            <span>{{ search ? 'Try another name, address, agency, or category.' : canAdd ? 'Add an authorized camera location to begin.' : 'There are no authorized camera locations to display.' }}</span>
            <RouterLink v-if="!search && canAdd" class="legacy-button legacy-button--primary cctv-empty-add" to="/cctv/new">Add New CCTV</RouterLink>
          </td></tr>
          <tr v-for="location in visibleLocations" :key="location.id" tabindex="0" :class="{ 'legacy-table__row--selected': selectedId === location.id }" @click="selectedId = location.id" @keydown.enter="selectedId = location.id" @keydown.space.prevent="selectedId = location.id">
            <td><strong>{{ location.name }}</strong><small class="cctv-table__meta">{{ location.isPublic ? 'Public map location' : 'Private map location' }}</small></td>
            <td>{{ location.address }}</td>
            <td>{{ location.longitude.toFixed(6) }} E {{ location.latitude.toFixed(6) }} N</td>
            <td>{{ location.agencyName ?? 'Agency unavailable' }}</td>
            <td><span class="cctv-category-tag" :class="`cctv-category-tag--${location.category}`">{{ location.category === 'regular' ? 'Regular' : 'Analytic' }}</span><small class="cctv-table__meta">{{ location.isActive ? 'Active' : 'Inactive' }}</small></td>
            <td class="cctv-row-actions" @click.stop>
              <RouterLink class="cctv-row-action" :to="`/cctv/${location.id}`" :aria-label="`View ${location.name}`" title="View CCTV">◉</RouterLink>
              <RouterLink v-if="canManage(location)" class="cctv-row-action" :to="`/cctv/${location.id}/edit`" :aria-label="`Edit ${location.name}`" title="Edit">✎</RouterLink>
              <button v-if="canManage(location)" class="cctv-row-action" type="button" :disabled="busyId === location.id" :aria-label="`${location.isActive ? 'Deactivate' : 'Activate'} ${location.name}`" @click="changeActive(location)">{{ location.isActive ? '◉' : '○' }}</button>
              <button v-if="authSession.state.role === 'administrator'" class="cctv-row-action cctv-row-action--delete" type="button" :disabled="busyId === location.id" :aria-label="`Delete ${location.name}`" @click="removeLocation(location)">×</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="legacy-table-footer">
      <span v-if="status === 'ready'">Showing {{ firstEntry }} to {{ lastEntry }} of {{ filteredLocations.length }} entries</span>
      <span v-else> </span>
      <div class="legacy-pagination" aria-label="CCTV table pages">
        <button type="button" aria-label="Previous page" :disabled="page <= 1" @click="page--">‹</button>
        <span>{{ page }} / {{ pageCount }}</span>
        <button type="button" aria-label="Next page" :disabled="page >= pageCount" @click="page++">›</button>
      </div>
    </div>
  </section>
</template>
