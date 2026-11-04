// @vitest-environment happy-dom
import { createApp, nextTick } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { getOwnProfile, getOwnProfilePhotoUrl, refreshDisplayName, updateOwnProfile, updateOwnProfilePhoto } = vi.hoisted(() => ({
  getOwnProfile: vi.fn(), getOwnProfilePhotoUrl: vi.fn(), refreshDisplayName: vi.fn(), updateOwnProfile: vi.fn(), updateOwnProfilePhoto: vi.fn(),
}))
vi.mock('../auth/session', () => ({ authSession: { state: { user: { id: 'user-1' } }, refreshDisplayName } }))
vi.mock('../lib/supabase', () => ({ supabaseClient: {} }))
vi.mock('../data/account', () => ({ getOwnProfile, getOwnProfilePhotoUrl, updateOwnProfile, updateOwnProfilePhoto, profileCoordinates: (lat: string, lng: string) => ({ latitude: lat ? Number(lat) : null, longitude: lng ? Number(lng) : null }) }))

import ProfilePage from './ProfilePage.vue'

let app: ReturnType<typeof createApp> | undefined
let host: HTMLDivElement | undefined

async function mountProfile() {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/profile', component: ProfilePage }, { path: '/', component: { template: '<div />' } }] })
  await router.push('/profile')
  await router.isReady()
  host = document.createElement('div')
  app = createApp(RouterView)
  app.use(router)
  app.mount(host)
  for (let i = 0; i < 4; i += 1) { await Promise.resolve(); await nextTick() }
  return host
}

afterEach(() => {
  app?.unmount(); host?.remove(); app = undefined; host = undefined
  getOwnProfile.mockReset().mockResolvedValue({ displayName: 'Existing', address: '', latitude: null, longitude: null, description: '', avatarPath: null })
  getOwnProfilePhotoUrl.mockReset().mockResolvedValue(null)
  updateOwnProfile.mockReset().mockImplementation(async (_client, _user, input) => input)
  updateOwnProfilePhoto.mockReset()
  refreshDisplayName.mockReset()
})

describe('Edit Profile', () => {
  it('loads the signed-in profile, keeps pending fields disabled, and refreshes account display after save', async () => {
    getOwnProfile.mockResolvedValue({ displayName: 'Existing', address: 'Aceh', latitude: 5.5, longitude: 95.3, description: 'Description', avatarPath: null })
    updateOwnProfile.mockImplementation(async (_client, _userId, input) => input)
    const root = await mountProfile()
    expect((root.querySelector<HTMLInputElement>('#profile-name')!).value).toBe('Existing')
    expect(root.querySelector<HTMLInputElement>('#profile-address')?.disabled).toBe(true)
    const name = root.querySelector<HTMLInputElement>('#profile-name')!
    name.value = 'Updated'
    name.dispatchEvent(new Event('input', { bubbles: true }))
    root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    for (let i = 0; i < 5; i += 1) { await Promise.resolve(); await nextTick() }
    expect(updateOwnProfile).toHaveBeenCalledWith({}, 'user-1', expect.objectContaining({ displayName: 'Updated' }), false)
    expect(refreshDisplayName).toHaveBeenCalledOnce()
    expect(root.querySelector('[role="status"]')?.textContent).toContain('Profile updated')
  })
})
