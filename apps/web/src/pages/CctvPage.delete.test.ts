// @vitest-environment happy-dom

import { createApp, nextTick } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import CctvPage from './CctvPage.vue'

const harness = vi.hoisted(() => ({
  auth: { status: 'authenticated', role: 'administrator', agencyIds: [] as string[] },
  listCctvLocations: vi.fn(),
  listCctvAgencies: vi.fn(),
  inspectCctvDeleteDependencies: vi.fn(),
  permanentlyDeleteCctvLocation: vi.fn(),
  isCctvSnapshotReferenced: vi.fn(),
  removePrivateImage: vi.fn(),
}))

vi.mock('../auth/session', () => ({ authSession: { state: harness.auth } }))
vi.mock('../lib/supabase', () => ({ supabaseClient: {} }))
vi.mock('../data/cctvManagement', () => ({
  canManageCctvLocation: () => true,
  inspectCctvDeleteDependencies: harness.inspectCctvDeleteDependencies,
  isCctvSnapshotReferenced: harness.isCctvSnapshotReferenced,
  listCctvAgencies: harness.listCctvAgencies,
  listCctvLocations: harness.listCctvLocations,
  pageCctvLocations: (rows: unknown[]) => rows,
  permanentlyDeleteCctvLocation: harness.permanentlyDeleteCctvLocation,
  searchCctvLocations: (rows: unknown[]) => rows,
  setCctvLocationActive: vi.fn().mockResolvedValue(true),
  sortCctvLocations: (rows: unknown[]) => rows,
}))
vi.mock('../data/privateMedia', () => ({ removePrivateImage: harness.removePrivateImage }))

const location = {
  id: 'camera-1', name: 'Test Camera', address: 'Banda Aceh', category: 'regular' as const,
  agencyId: 'agency-1', agencyName: 'Test Agency', longitude: 95.3, latitude: 5.5,
  isActive: true, isPublic: false, snapshotPath: 'camera-1/image.webp', updatedAt: '2026-11-05T00:00:00Z',
}

let app: ReturnType<typeof createApp> | undefined
let host: HTMLDivElement | undefined

async function settle(): Promise<void> {
  for (let index = 0; index < 6; index += 1) await Promise.resolve()
  await nextTick()
}

async function mountPage(): Promise<void> {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/cctv', component: CctvPage }] })
  await router.push('/cctv')
  await router.isReady()
  host = document.createElement('div')
  document.body.append(host)
  app = createApp(CctvPage)
  app.use(router)
  app.mount(host)
  await settle()
}

beforeEach(() => {
  harness.auth.status = 'authenticated'
  harness.auth.role = 'administrator'
  harness.auth.agencyIds = []
  harness.listCctvLocations.mockResolvedValue([location])
  harness.listCctvAgencies.mockResolvedValue([{ id: 'agency-1', name: 'Test Agency' }])
  harness.inspectCctvDeleteDependencies.mockResolvedValue({
    observationCount: 2, hasPrivateConfig: true, snapshotPath: location.snapshotPath, imageShared: false,
  })
  harness.permanentlyDeleteCctvLocation.mockResolvedValue({ observationCount: 2, privateConfigDeleted: true, snapshotPath: location.snapshotPath })
  harness.isCctvSnapshotReferenced.mockResolvedValue(false)
  harness.removePrivateImage.mockResolvedValue(undefined)
  const dialogPrototype = Object.getPrototypeOf(document.createElement('dialog')) as HTMLElement
  Object.defineProperty(dialogPrototype, 'showModal', {
    configurable: true,
    value(this: HTMLElement) { this.setAttribute('open', '') },
  })
  Object.defineProperty(dialogPrototype, 'close', {
    configurable: true,
    value(this: HTMLElement) {
      this.removeAttribute('open')
      this.dispatchEvent(new Event('close'))
    },
  })
})

afterEach(() => {
  app?.unmount()
  host?.remove()
  app = undefined
  host = undefined
  vi.clearAllMocks()
})

describe('CCTV permanent-delete confirmation', () => {
  it('shows the history count, requires the exact camera name, and cancel changes no data', async () => {
    await mountPage()
    host?.querySelector<HTMLButtonElement>('[aria-label="Delete Test Camera"]')?.click()
    await settle()

    const dialog = host?.querySelector('dialog')
    expect(dialog?.textContent).toContain('2 Traffic Observations')
    const confirm = [...(dialog?.querySelectorAll('button') ?? [])].find((button) => button.textContent?.includes('Delete Permanently')) as HTMLButtonElement
    const nameInput = dialog?.querySelector<HTMLInputElement>('#confirm-cctv-name')
    expect(confirm.disabled).toBe(true)
    if (nameInput) {
      nameInput.value = 'Test Camera '
      nameInput.dispatchEvent(new Event('input', { bubbles: true }))
    }
    await settle()
    expect(confirm.disabled).toBe(true)
    if (nameInput) {
      nameInput.value = 'Test Camera'
      nameInput.dispatchEvent(new Event('input', { bubbles: true }))
    }
    await settle()
    expect(confirm.disabled).toBe(false)
    dialog?.querySelector<HTMLButtonElement>('button')?.click()
    await settle()
    expect(harness.permanentlyDeleteCctvLocation).not.toHaveBeenCalled()
    expect(harness.listCctvLocations).toHaveBeenCalledTimes(1)
  })

  it('reports partial image cleanup failure after permanent database deletion', async () => {
    harness.removePrivateImage.mockRejectedValue(new Error('Storage unavailable'))
    await mountPage()
    host?.querySelector<HTMLButtonElement>('[aria-label="Delete Test Camera"]')?.click()
    await settle()
    const input = host?.querySelector<HTMLInputElement>('#confirm-cctv-name')
    if (input) {
      input.value = 'Test Camera'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }
    await settle()
    const deleteButton = [...(host?.querySelectorAll('dialog button') ?? [])].find((button) => button.textContent?.includes('Delete Permanently')) as HTMLButtonElement
    deleteButton.click()
    await settle()
    expect(harness.permanentlyDeleteCctvLocation).toHaveBeenCalled()
    expect(host?.textContent).toContain('CCTV deleted, but image cleanup requires attention.')
    expect(host?.textContent).toContain('Retry image cleanup')
  })
})
