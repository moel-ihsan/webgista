// @vitest-environment happy-dom
import { createApp, nextTick } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

const {
  createAgency, deleteAgency, listAgencies, loadMapViewport, saveMapViewport, flags,
} = vi.hoisted(() => ({
  createAgency: vi.fn().mockResolvedValue({ id: 'agency-new', name: 'New Agency', isPublic: false }),
  deleteAgency: vi.fn().mockResolvedValue(true),
  listAgencies: vi.fn().mockResolvedValue([{ id: 'agency-1', name: 'Dishub', isPublic: false }]),
  loadMapViewport: vi.fn().mockResolvedValue({ latitude: 5.5, longitude: 95.3, zoom: 12 }),
  saveMapViewport: vi.fn().mockImplementation(async (_client, viewport) => viewport),
  flags: { agencyRemovalEnabled: false },
}))

vi.mock('../auth/session', () => ({ authSession: { state: { role: 'administrator', agencyIds: [] } } }))
vi.mock('../lib/supabase', () => ({ supabaseClient: {} }))
vi.mock('../config/app', () => ({ appConfig: { get agencyRemovalEnabled() { return flags.agencyRemovalEnabled } } }))
vi.mock('../data/agencies', () => ({ createAgency, deleteAgency, listAgencies }))
vi.mock('../data/mapSettings', () => ({
  DEFAULT_MAP_VIEWPORT: { latitude: 5.5483, longitude: 95.3238, zoom: 11.2 },
  loadMapViewport,
  saveMapViewport,
  validateMapViewport: (viewport: { latitude: number; longitude: number; zoom: number }) =>
    viewport.latitude < -90 || viewport.latitude > 90 ? 'Latitude must be between -90 and 90.'
      : viewport.longitude < -180 || viewport.longitude > 180 ? 'Longitude must be between -180 and 180.'
        : viewport.zoom < 8 || viewport.zoom > 18 ? 'Zoom must be between 8 and 18.' : null,
}))
vi.mock('../components/map/TrafficMap.vue', () => ({
  default: {
    props: ['viewport'],
    emits: ['viewport-changed'],
    template: '<button type="button" data-settings-map @click="$emit(\'viewport-changed\', { latitude: 5.559729, longitude: 95.330911, zoom: 13 })">Select map center</button>',
  },
}))

import SettingsPage from './SettingsPage.vue'

let app: ReturnType<typeof createApp> | undefined
let host: HTMLDivElement | undefined

async function flush(): Promise<void> {
  for (let index = 0; index < 5; index += 1) { await Promise.resolve(); await nextTick() }
}

async function mountSettings() {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/settings', component: SettingsPage }] })
  await router.push('/settings')
  await router.isReady()
  host = document.createElement('div')
  app = createApp(RouterView)
  app.use(router)
  app.mount(host)
  await flush()
  return host
}

afterEach(() => {
  app?.unmount()
  host?.remove()
  app = undefined
  host = undefined
  flags.agencyRemovalEnabled = false
  vi.unstubAllGlobals()
  createAgency.mockReset().mockResolvedValue({ id: 'agency-new', name: 'New Agency', isPublic: false })
  deleteAgency.mockReset().mockResolvedValue(true)
  listAgencies.mockReset().mockResolvedValue([{ id: 'agency-1', name: 'Dishub', isPublic: false }])
  loadMapViewport.mockReset().mockResolvedValue({ latitude: 5.5, longitude: 95.3, zoom: 12 })
  saveMapViewport.mockReset().mockImplementation(async (_client, viewport) => viewport)
})

describe('Settings map defaults and agency tags', () => {
  it('loads the global viewport, accepts a map selection, and saves the synchronized values', async () => {
    const root = await mountSettings()
    expect(root.querySelector<HTMLInputElement>('#setting-latitude')?.value).toBe('5.5')
    expect(root.querySelector<HTMLInputElement>('#setting-longitude')?.value).toBe('95.3')
    expect(root.querySelector<HTMLInputElement>('#setting-zoom')?.value).toBe('12')

    root.querySelector<HTMLButtonElement>('[data-settings-map]')!.click()
    await nextTick()
    expect(root.querySelector<HTMLInputElement>('#setting-latitude')?.value).toBe('5.559729')
    expect(root.querySelector<HTMLInputElement>('#setting-longitude')?.value).toBe('95.330911')
    expect(root.querySelector<HTMLInputElement>('#setting-zoom')?.value).toBe('13')

    root.querySelector<HTMLButtonElement>('.legacy-settings__fields button')!.click()
    await flush()
    expect(saveMapViewport).toHaveBeenCalledWith({}, { latitude: 5.559729, longitude: 95.330911, zoom: 13 })
    expect(root.querySelector('[role="status"]')?.textContent).toContain('saved')
  })

  it('accepts decimal-comma coordinates and rejects invalid coordinates before saving', async () => {
    const root = await mountSettings()
    const set = (selector: string, value: string) => {
      const input = root.querySelector<HTMLInputElement>(selector)!
      input.value = value
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }
    set('#setting-latitude', '5,559729')
    set('#setting-longitude', '95,330911')
    set('#setting-zoom', '13')
    root.querySelector<HTMLButtonElement>('.legacy-settings__fields button')!.click()
    await flush()
    expect(saveMapViewport).toHaveBeenCalledWith({}, { latitude: 5.559729, longitude: 95.330911, zoom: 13 })

    set('#setting-latitude', 'north')
    root.querySelector<HTMLButtonElement>('.legacy-settings__fields button')!.click()
    await nextTick()
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('valid latitude')
    expect(saveMapViewport).toHaveBeenCalledOnce()
  })

  it('creates private agency tags, removes only after a successful database result, and reports FK protection', async () => {
    const root = await mountSettings()
    expect(root.textContent).toContain('Dishub')
    root.querySelector<HTMLButtonElement>('.legacy-settings__agencies > .legacy-agency-tags > button')!.click()
    await nextTick()
    const input = root.querySelector<HTMLInputElement>('[aria-label="New agency name"]')!
    input.value = 'New Agency'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('blur'))
    await flush()
    expect(createAgency).toHaveBeenCalledWith({}, 'New Agency')
    expect(root.textContent).toContain('New Agency')
    expect(root.textContent).toContain('added as a private agency')

    expect(root.querySelector('[aria-label="Remove Dishub"]')).toBeNull()
    expect(root.textContent).toContain('disabled for this deployment')
    expect(root.textContent).toContain('linked to cameras or editor memberships are protected')
    expect(root.textContent).toContain('Dishub')
  })

  it('requires confirmation before agency removal and updates the list only after success', async () => {
    flags.agencyRemovalEnabled = true
    const confirm = vi.fn().mockReturnValue(false)
    vi.stubGlobal('confirm', confirm)
    const root = await mountSettings()

    root.querySelector<HTMLButtonElement>('[aria-label="Remove Dishub"]')!.click()
    await flush()
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Remove Dishub'))
    expect(deleteAgency).not.toHaveBeenCalled()
    expect(root.textContent).toContain('Dishub')

    confirm.mockReturnValue(true)
    root.querySelector<HTMLButtonElement>('[aria-label="Remove Dishub"]')!.click()
    await flush()
    expect(deleteAgency).toHaveBeenCalledWith({}, 'agency-1')
    expect([...root.querySelectorAll('.legacy-agency-tag')].some((tag) => tag.textContent?.includes('Dishub'))).toBe(false)
    expect(root.textContent).toContain('Dishub removed')
  })
})
