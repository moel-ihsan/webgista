<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { authSession } from '../auth/session'
import { inspectCctvDeleteDependencies, isCctvSnapshotReferenced, listCctvAgencies, listCctvLocations, canManageCctvLocation, pageCctvLocations, permanentlyDeleteCctvLocation, searchCctvLocations, setCctvLocationActive, sortCctvLocations, type CctvDeleteDependencies, type CctvManagementLocation, type CctvSortField } from '../data/cctvManagement'
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
const deleteDialog = ref<HTMLDialogElement | null>(null)
const deleteCandidate = ref<{ location: CctvManagementLocation; dependencies: CctvDeleteDependencies } | null>(null)
const deleteNameConfirmation = ref('')
const pendingImageCleanupPath = ref<string | null>(null)
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
    pendingImageCleanupPath.value = null
    closeDeleteDialog()
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

async function changeActive(location: CctvManagementLocation, confirmDeactivation = true): Promise<void> {
  if (authSession.state.status !== 'authenticated' || !supabaseClient || busyId.value) return
  if (confirmDeactivation && location.isActive && !window.confirm(`Deactivate “${location.name}”?`)) return
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
  if (pendingImageCleanupPath.value) {
    mutationMessage.value = 'Retry the pending CCTV image cleanup before starting another permanent delete.'
    return
  }
  const revision = accessRevision
  busyId.value = location.id
  mutationMessage.value = ''
  try {
    const dependencies = await inspectCctvDeleteDependencies(supabaseClient, location)
    if (revision !== accessRevision) return
    deleteCandidate.value = { location, dependencies }
    deleteNameConfirmation.value = ''
    await nextTick()
    deleteDialog.value?.showModal()
  } catch (error) {
    if (revision === accessRevision) mutationMessage.value = error instanceof Error ? error.message : 'CCTV dependencies could not be checked.'
  } finally {
    if (revision === accessRevision) busyId.value = null
  }
}

function closeDeleteDialog(): void {
  deleteDialog.value?.close()
  deleteCandidate.value = null
  deleteNameConfirmation.value = ''
}

async function deactivateInstead(): Promise<void> {
  const location = deleteCandidate.value?.location
  closeDeleteDialog()
  if (location) await changeActive(location, false)
}

async function confirmPermanentDelete(): Promise<void> {
  const candidate = deleteCandidate.value
  if (!candidate || authSession.state.status !== 'authenticated' || authSession.state.role !== 'administrator' || !supabaseClient || busyId.value) return
  const { location, dependencies } = candidate
  if (dependencies.observationCount > 0 && deleteNameConfirmation.value !== location.name) return
  const revision = accessRevision
  busyId.value = location.id
  mutationMessage.value = ''
  try {
    const deleted = await permanentlyDeleteCctvLocation(supabaseClient, location.id, dependencies)
    closeDeleteDialog()
    mutationMessage.value = `“${location.name}” permanently deleted; ${deleted.observationCount} traffic observations removed.`
    if (revision === accessRevision) await refresh()
    if (deleted.snapshotPath) {
      try {
        if (authSession.state.status !== 'authenticated' || authSession.state.role !== 'administrator') throw new Error('Administrator session ended before storage cleanup.')
        if (await isCctvSnapshotReferenced(supabaseClient, deleted.snapshotPath)) {
          mutationMessage.value = `“${location.name}” deleted. Its image was retained because another CCTV still references it.`
        } else {
          await removePrivateImage(supabaseClient, 'cctv-images', deleted.snapshotPath)
        }
      } catch {
        pendingImageCleanupPath.value = deleted.snapshotPath
        mutationMessage.value = 'CCTV deleted, but image cleanup requires attention.'
      }
    }
  } catch (error) {
    if (revision === accessRevision) mutationMessage.value = error instanceof Error ? error.message : 'CCTV could not be permanently deleted.'
  } finally {
    if (revision === accessRevision) busyId.value = null
  }
}

async function retryImageCleanup(): Promise<void> {
  const path = pendingImageCleanupPath.value
  if (!path || authSession.state.status !== 'authenticated' || authSession.state.role !== 'administrator' || !supabaseClient || busyId.value) return
  busyId.value = 'image-cleanup'
  try {
    if (await isCctvSnapshotReferenced(supabaseClient, path)) {
      mutationMessage.value = 'The image was retained because a CCTV still references it.'
    } else {
      await removePrivateImage(supabaseClient, 'cctv-images', path)
      mutationMessage.value = 'CCTV image cleanup completed.'
    }
    pendingImageCleanupPath.value = null
  } catch {
    mutationMessage.value = 'CCTV deleted, but image cleanup still requires attention.'
  } finally {
    busyId.value = null
  }
}

function onDeleteDialogClose(): void {
  deleteCandidate.value = null
  deleteNameConfirmation.value = ''
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

    <p v-if="mutationMessage" class="cctv-management-message" role="status">
      {{ mutationMessage }}
      <button v-if="pendingImageCleanupPath" class="legacy-button legacy-button--outline" type="button" :disabled="busyId === 'image-cleanup'" @click="retryImageCleanup">Retry image cleanup</button>
    </p>
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

    <dialog ref="deleteDialog" class="cctv-delete-dialog" aria-labelledby="cctv-delete-title" @close="onDeleteDialogClose">
      <template v-if="deleteCandidate">
        <h2 id="cctv-delete-title">Delete CCTV Permanently?</h2>
        <p>Camera: <strong>{{ deleteCandidate.location.name }}</strong></p>
        <p>This CCTV contains:</p>
        <ul>
          <li>{{ deleteCandidate.dependencies.observationCount }} Traffic Observations</li>
          <li>{{ deleteCandidate.dependencies.hasPrivateConfig ? 'Associated video configuration' : 'No associated video configuration' }}</li>
          <li v-if="deleteCandidate.dependencies.snapshotPath">
            {{ deleteCandidate.dependencies.imageShared ? 'Associated image shared with another CCTV (will be retained)' : 'Associated image (will be removed if orphaned)' }}
          </li>
          <li v-else>No associated image</li>
        </ul>
        <p v-if="deleteCandidate.dependencies.observationCount > 0" class="cctv-delete-dialog__warning">
          Deleting this CCTV will permanently remove the selected camera and its associated observation history.
        </p>
        <p v-else>Deleting this CCTV permanently removes the selected camera and its linked configuration.</p>
        <p><strong>This action cannot be undone.</strong></p>
        <label v-if="deleteCandidate.dependencies.observationCount > 0" class="cctv-delete-dialog__confirm-label" for="confirm-cctv-name">
          Type the exact CCTV name to enable permanent deletion.
        </label>
        <input
          v-if="deleteCandidate.dependencies.observationCount > 0"
          id="confirm-cctv-name"
          v-model="deleteNameConfirmation"
          class="legacy-input"
          type="text"
          autocomplete="off"
          :placeholder="deleteCandidate.location.name"
        />
        <div class="cctv-delete-dialog__actions">
          <button class="legacy-button legacy-button--outline" type="button" @click="closeDeleteDialog">Cancel</button>
          <button v-if="deleteCandidate.location.isActive" class="legacy-button legacy-button--outline" type="button" :disabled="busyId !== null" @click="deactivateInstead">Deactivate Instead</button>
          <button
            class="legacy-button cctv-delete-dialog__delete"
            type="button"
            :disabled="busyId !== null || (deleteCandidate.dependencies.observationCount > 0 && deleteNameConfirmation !== deleteCandidate.location.name)"
            @click="confirmPermanentDelete"
          >Delete Permanently</button>
        </div>
      </template>
    </dialog>
  </section>
</template>
