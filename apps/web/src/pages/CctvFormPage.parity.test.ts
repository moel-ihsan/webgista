// @vitest-environment happy-dom
import { createApp, nextTick } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { createCctvLocation, getCctvDemoAssociation, listCctvAgencies, replaceCctvSnapshot, saveCctvDemoVideo, updateCctvLocation, validateCctvLocationInput, validateImage } = vi.hoisted(() => ({
  createCctvLocation: vi.fn().mockResolvedValue('camera-new'),
  getCctvDemoAssociation: vi.fn().mockResolvedValue({ video: null, editable: true }),
  listCctvAgencies: vi.fn().mockResolvedValue([{ id: 'agency-1', name: 'Testing Agency' }]),
  replaceCctvSnapshot: vi.fn().mockResolvedValue({ path: 'camera-new/image.jpg', url: 'signed-image' }),
  validateCctvLocationInput: vi.fn().mockReturnValue(null),
  saveCctvDemoVideo: vi.fn().mockResolvedValue(undefined),
  updateCctvLocation: vi.fn().mockResolvedValue(true),
  validateImage: vi.fn().mockResolvedValue('jpg'),
}))

vi.mock('../auth/session', () => ({
  authSession: { state: { status: 'authenticated', user: { id: 'user-1' }, role: 'administrator', agencyIds: [] } },
}))
vi.mock('../lib/supabase', () => ({ supabaseClient: {} }))
vi.mock('../data/cctvManagement', () => ({
  createCctvLocation,
  getCctvLocation: vi.fn(),
  getCctvSnapshotUrl: vi.fn().mockResolvedValue(null),
  listCctvAgencies,
  replaceCctvSnapshot,
  updateCctvLocation,
  validateCctvLocationInput,
}))
vi.mock('../data/cctvDemoVideo', () => ({ getCctvDemoAssociation, saveCctvDemoVideo }))
vi.mock('../data/privateMedia', () => ({ validateImage }))
vi.mock('../map/boundary', () => ({ loadBoundary: vi.fn().mockRejectedValue(new Error('offline')), isWithinBoundary: vi.fn().mockReturnValue(true) }))
vi.mock('../components/map/TrafficMap.vue', () => ({
  default: { props: ['locationCoordinates'], emits: ['location-selected'], template: '<button type="button" data-map-picker @click="$emit(\'location-selected\', [95.33, 5.55])">Map picker</button>' },
}))

import CctvFormPage from './CctvFormPage.vue'

let app: ReturnType<typeof createApp> | undefined
let host: HTMLDivElement | undefined

async function flush(): Promise<void> {
  for (let index = 0; index < 5; index += 1) {
    await Promise.resolve()
    await nextTick()
  }
}

async function mountForm() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/cctv/new', component: CctvFormPage },
      { path: '/cctv', component: { template: '<div />' } },
    ],
  })
  await router.push('/cctv/new')
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
  createCctvLocation.mockClear()
  createCctvLocation.mockResolvedValue('camera-new')
  updateCctvLocation.mockClear()
  updateCctvLocation.mockResolvedValue(true)
  replaceCctvSnapshot.mockClear()
  validateImage.mockClear()
  validateImage.mockResolvedValue('jpg')
  listCctvAgencies.mockClear()
  listCctvAgencies.mockResolvedValue([{ id: 'agency-1', name: 'Testing Agency' }])
  validateCctvLocationInput.mockClear()
  validateCctvLocationInput.mockReturnValue(null)
  saveCctvDemoVideo.mockReset()
  saveCctvDemoVideo.mockResolvedValue(undefined)
})

describe('CCTV form v1 field parity', () => {
  it('keeps the v1 field order and gates image upload until private Storage is configured', async () => {
    const root = await mountForm()
    const fields = [...root.querySelectorAll('label[for]')].map((label) => label.textContent?.trim())
    expect(fields.slice(0, 7)).toEqual(['Name', 'Category', 'Address', 'Latitude (N)', 'Longitude (E)', 'Agency', 'Image'])
    expect(root.querySelector<HTMLInputElement>('#cctv-image')?.disabled).toBe(true)
    expect(root.textContent).toContain('private Storage migration is approved and applied')
    expect(root.querySelector('#cctv-demo-video')).toBeNull()
    const category = root.querySelector<HTMLSelectElement>('#cctv-category')!
    category.value = 'analytic'
    category.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
    expect(root.querySelector<HTMLSelectElement>('#cctv-demo-video')?.options.length).toBe(3)
  })

  it('keeps the map picker in the form and excludes unavailable legacy fields from persistence', async () => {
    const root = await mountForm()
    root.querySelector<HTMLButtonElement>('[data-map-picker]')!.click()
    await nextTick()
    const set = (selector: string, value: string) => {
      const field = root.querySelector<HTMLInputElement | HTMLSelectElement>(selector)!
      field.value = value
      field.dispatchEvent(new Event('input', { bubbles: true }))
      field.dispatchEvent(new Event('change', { bubbles: true }))
    }
    set('#cctv-name', 'Camera One')
    set('#cctv-address', 'Banda Aceh')
    set('#cctv-category', 'regular')
    set('#cctv-agency', 'agency-1')
    root.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await flush()
    expect(validateCctvLocationInput).toHaveBeenCalledWith(expect.objectContaining({ longitude: 95.33, latitude: 5.55 }), ['agency-1'])
    expect(createCctvLocation).toHaveBeenCalledWith({}, expect.objectContaining({
      name: 'Camera One', address: 'Banda Aceh', agencyId: 'agency-1', longitude: 95.33, latitude: 5.55,
    }))
    expect(createCctvLocation.mock.calls[0]?.[1]).not.toHaveProperty('url')
    expect(createCctvLocation.mock.calls[0]?.[1]).not.toHaveProperty('image')
  })

  it('saves only a selected built-in demo association after creating the camera', async () => {
    const root = await mountForm()
    root.querySelector<HTMLButtonElement>('[data-map-picker]')!.click()
    await nextTick()
    const set = (selector: string, value: string) => {
      const field = root.querySelector<HTMLInputElement | HTMLSelectElement>(selector)!
      field.value = value
      field.dispatchEvent(new Event('input', { bubbles: true }))
      field.dispatchEvent(new Event('change', { bubbles: true }))
    }
    set('#cctv-name', 'Demo Camera')
    set('#cctv-address', 'Licensed demo footage, not a live camera location')
    set('#cctv-category', 'analytic')
    set('#cctv-agency', 'agency-1')
    await nextTick()
    set('#cctv-demo-video', 'traffic-sample-01')
    root.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await flush()
    expect(createCctvLocation).toHaveBeenCalledTimes(1)
    expect(saveCctvDemoVideo).toHaveBeenCalledWith({}, 'camera-new', 'user-1', 'traffic-sample-01')
  })

  it('rejects a demo clip on a camera not clearly identified as QA/demo', async () => {
    const root = await mountForm()
    root.querySelector<HTMLButtonElement>('[data-map-picker]')!.click()
    await nextTick()
    const set = (selector: string, value: string) => {
      const field = root.querySelector<HTMLInputElement | HTMLSelectElement>(selector)!
      field.value = value
      field.dispatchEvent(new Event('input', { bubbles: true }))
      field.dispatchEvent(new Event('change', { bubbles: true }))
    }
    set('#cctv-name', 'Simpang Jambo Tape')
    set('#cctv-address', 'Banda Aceh')
    set('#cctv-category', 'analytic')
    set('#cctv-agency', 'agency-1')
    await nextTick()
    set('#cctv-demo-video', 'traffic-sample-01')
    root.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await flush()
    expect(root.textContent).toContain('clearly identified as QA or demo')
    expect(createCctvLocation).not.toHaveBeenCalled()
  })

  it('keeps form values and the selected demo when association saving fails, then retries without duplicating the camera', async () => {
    saveCctvDemoVideo.mockRejectedValueOnce(new Error('The demo video association could not be saved.'))
    const root = await mountForm()
    root.querySelector<HTMLButtonElement>('[data-map-picker]')!.click()
    await nextTick()
    const set = (selector: string, value: string) => {
      const field = root.querySelector<HTMLInputElement | HTMLSelectElement>(selector)!
      field.value = value
      field.dispatchEvent(new Event('input', { bubbles: true }))
      field.dispatchEvent(new Event('change', { bubbles: true }))
    }
    set('#cctv-name', 'Demo Camera')
    set('#cctv-address', 'Licensed demo footage, not a live camera location')
    set('#cctv-category', 'analytic')
    set('#cctv-agency', 'agency-1')
    await nextTick()
    set('#cctv-demo-video', 'traffic-sample-01')
    const form = root.querySelector<HTMLFormElement>('form')!
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await flush()
    expect(root.querySelector('form')).not.toBeNull()
    expect(root.querySelector<HTMLInputElement>('#cctv-name')?.value).toBe('Demo Camera')
    expect(root.querySelector<HTMLSelectElement>('#cctv-demo-video')?.value).toBe('traffic-sample-01')
    expect(root.textContent).toContain('CCTV details were saved, but the video association could not be saved')
    expect(saveCctvDemoVideo).toHaveBeenCalledTimes(1)

    root.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await flush()
    expect(createCctvLocation).toHaveBeenCalledTimes(1)
    expect(saveCctvDemoVideo).toHaveBeenCalledTimes(2)
  })
})
