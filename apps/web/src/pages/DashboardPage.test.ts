// @vitest-environment happy-dom
import { createApp, nextTick } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { listRecentlyAddedCctv } = vi.hoisted(() => ({ listRecentlyAddedCctv: vi.fn() }))
vi.mock('../auth/session', () => ({ authSession: { state: { status: 'authenticated', role: 'agency_editor' } } }))
vi.mock('../config/app', () => ({ appConfig: { privateMediaEnabled: true } }))
vi.mock('../lib/supabase', () => ({ supabaseClient: {} }))
vi.mock('../data/dashboard', () => ({
  listRecentlyAddedCctv,
  formatRecentDate: () => '2 days ago',
}))
vi.mock('../data/accountPresentation', () => ({ accountPresentation: {
  photoUrl: 'signed-profile-photo',
  profile: { displayName: 'Moel', address: 'Banda Aceh', latitude: 5.5, longitude: 95.3, description: 'WebGISTA profile' },
} }))
vi.mock('../components/map/TrafficMap.vue', () => ({ default: { template: '<div data-dashboard-map></div>' } }))

import DashboardPage from './DashboardPage.vue'

let app: ReturnType<typeof createApp> | undefined
let host: HTMLDivElement | undefined

async function flush(): Promise<void> {
  for (let index = 0; index < 5; index += 1) { await Promise.resolve(); await nextTick() }
}

afterEach(() => {
  app?.unmount()
  host?.remove()
  app = undefined
  host = undefined
  listRecentlyAddedCctv.mockReset().mockResolvedValue([{
    id: 'camera-1', name: 'Simpang Lima', address: 'Banda Aceh', date: '2026-11-03T00:00:00Z', isActive: true, imageUrl: 'signed-camera-photo',
  }])
})

describe('Dashboard profile and recent camera presentation', () => {
  it('uses the signed profile photo and saved profile values, then links recent CCTV to authorized editing', async () => {
    listRecentlyAddedCctv.mockResolvedValue([{
      id: 'camera-1', name: 'Simpang Lima', address: 'Banda Aceh', date: '2026-11-03T00:00:00Z', isActive: true, imageUrl: 'signed-camera-photo',
    }])
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: DashboardPage, name: 'dashboard' }, { path: '/cctv/:id/edit', name: 'cctv-edit', component: { template: '<div />' } }, { path: '/map', name: 'map', component: { template: '<div />' } }] })
    await router.push('/')
    await router.isReady()
    host = document.createElement('div')
    app = createApp(RouterView)
    app.use(router)
    app.mount(host)
    await flush()

    expect(host.querySelector('.legacy-office-card__photo img')?.getAttribute('src')).toBe('signed-profile-photo')
    expect(host.textContent).toContain('Banda Aceh')
    expect(host.textContent).toContain('5.5 N, 95.3 E')
    expect(host.textContent).toContain('WebGISTA profile')
    expect(host.querySelector('.legacy-recent__item img')?.getAttribute('src')).toBe('signed-camera-photo')
    expect(host.querySelector('.legacy-recent__item')?.getAttribute('href')).toBe('/cctv/camera-1/edit')
    expect(host.textContent).not.toContain('Agency profile is not connected')
    expect(host.textContent).not.toContain('CCTV update history is not connected')
  })
})
