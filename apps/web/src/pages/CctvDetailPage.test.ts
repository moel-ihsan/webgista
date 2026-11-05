// @vitest-environment happy-dom
import { createApp, nextTick } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { getCctvDetail, listTrafficObservations, privateImageUrl } = vi.hoisted(() => ({
  getCctvDetail: vi.fn(),
  listTrafficObservations: vi.fn(),
  privateImageUrl: vi.fn(),
}))

vi.mock('../auth/session', () => ({ authSession: { state: { status: 'authenticated', role: 'agency_editor' } } }))
vi.mock('../config/app', () => ({ appConfig: { privateMediaEnabled: true } }))
vi.mock('../lib/supabase', () => ({ supabaseClient: {} }))
vi.mock('../data/cctvDetail', () => ({ getCctvDetail }))
vi.mock('../data/trafficObservations', () => ({ listTrafficObservations }))
vi.mock('../data/privateMedia', () => ({ privateImageUrl }))

import CctvDetailPage from './CctvDetailPage.vue'

let app: ReturnType<typeof createApp> | undefined
let host: HTMLDivElement | undefined

async function flush(): Promise<void> {
  for (let index = 0; index < 6; index += 1) { await Promise.resolve(); await nextTick() }
}

function mountPage() {
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/cctv/:id', name: 'cctv-detail', component: CctvDetailPage },
    { path: '/map', name: 'map', component: { template: '<div />' } },
  ] })
  return router.push('/cctv/camera-1').then(async () => {
    await router.isReady()
    host = document.createElement('div')
    app = createApp(RouterView)
    app.use(router)
    app.mount(host)
    await flush()
  })
}

beforeEach(() => {
  getCctvDetail.mockReset().mockResolvedValue({
    id: 'camera-1', name: 'Simpang Jambo Tape', address: 'Banda Aceh', category: 'regular',
    agencyName: 'Test Agency', longitude: 95.330911, latitude: 5.559729, snapshotPath: 'camera-1/photo.jpg',
  })
  listTrafficObservations.mockReset().mockResolvedValue([{
    id: 'observation-1', cctvId: 'camera-1', windowStartedAt: '2026-11-05T09:00:00Z', windowEndedAt: '2026-11-05T09:05:00Z',
    condition: 'poor', countingMethod: 'manual', sourceKind: 'manual', lightVehicleCount: 2, heavyVehicleCount: 0,
    motorcycleCount: 1, bicycleCount: 0, sampledFrames: 0, qualityFlags: [],
  }])
  privateImageUrl.mockReset().mockResolvedValue('signed-photo')
})

afterEach(() => {
  app?.unmount()
  host?.remove()
  app = undefined
  host = undefined
})

describe('CCTV detail page', () => {
  it('shows the authorized image, saved camera metadata, latest observation, and real history', async () => {
    await mountPage()

    expect(getCctvDetail).toHaveBeenCalledWith({}, 'camera-1', true)
    expect(privateImageUrl).toHaveBeenCalledWith({}, 'cctv-images', 'camera-1/photo.jpg')
    expect(host?.querySelector('.cctv-detail-media > img')?.getAttribute('src')).toBe('signed-photo')
    expect(host?.textContent).toContain('Simpang Jambo Tape')
    expect(host?.textContent).toContain('Test Agency')
    expect(host?.textContent).toContain('Poor')
    expect(host?.textContent).toContain('Manual')
    expect(host?.textContent).toContain('Observation History')
    expect(host?.querySelector('.cctv-detail-actions a')?.getAttribute('href')).toBe('/map?cctv=camera-1')
  })

  it('shows No Data and an honest video fallback when no saved observation or image is available', async () => {
    getCctvDetail.mockResolvedValue({
      id: 'camera-1', name: 'Analytic Camera', address: 'Banda Aceh', category: 'analytic',
      agencyName: 'Agency', longitude: 95.3, latitude: 5.5, snapshotPath: null,
    })
    listTrafficObservations.mockResolvedValue([])
    await mountPage()

    expect(host?.textContent).toContain('No Data')
    expect(host?.textContent).toContain('Secure video playback is not configured')
    expect(host?.querySelector('video')).toBeNull()
  })

  it('uses the same neutral not-found state for absent and RLS-hidden camera rows', async () => {
    getCctvDetail.mockResolvedValue(null)
    await mountPage()
    expect(host?.textContent).toContain('CCTV location not found or not available to this account.')
  })
})
