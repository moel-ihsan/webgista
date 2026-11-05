import { afterEach, describe, expect, it, vi } from 'vitest'

const { getOwnProfile, getOwnProfilePhotoUrl } = vi.hoisted(() => ({
  getOwnProfile: vi.fn(),
  getOwnProfilePhotoUrl: vi.fn(),
}))
vi.mock('./account', () => ({ getOwnProfile, getOwnProfilePhotoUrl }))

import { accountPresentation, clearAccountPresentation, refreshAccountPresentation } from './accountPresentation'

afterEach(() => {
  clearAccountPresentation()
  getOwnProfile.mockReset()
  getOwnProfilePhotoUrl.mockReset()
})

describe('shared account presentation', () => {
  it('loads own profile and a private signed photo for header and Dashboard consumers', async () => {
    getOwnProfile.mockResolvedValue({ displayName: 'Moel', address: 'Banda Aceh', latitude: 5.5, longitude: 95.3, description: 'Profile', avatarPath: 'user-1/photo.webp' })
    getOwnProfilePhotoUrl.mockResolvedValue('signed-url')
    await refreshAccountPresentation({} as never, 'user-1', true, true)

    expect(getOwnProfile).toHaveBeenCalledWith({}, 'user-1', true)
    expect(getOwnProfilePhotoUrl).toHaveBeenCalledWith({}, 'user-1/photo.webp')
    expect(accountPresentation).toMatchObject({ userId: 'user-1', photoUrl: 'signed-url', profile: { displayName: 'Moel' } })
  })

  it('does not request a photo when media is disabled and clears stale signed state on logout', async () => {
    getOwnProfile.mockResolvedValue({ displayName: 'Moel', address: '', latitude: null, longitude: null, description: '', avatarPath: 'user-1/photo.webp' })
    await refreshAccountPresentation({} as never, 'user-1', false, false)
    expect(getOwnProfilePhotoUrl).not.toHaveBeenCalled()
    expect(accountPresentation.photoUrl).toBeNull()
    clearAccountPresentation()
    expect(accountPresentation).toEqual({ userId: null, profile: null, photoUrl: null })
  })

  it('ignores a stale profile request after the session is cleared', async () => {
    let resolveProfile: (value: unknown) => void = () => undefined
    getOwnProfile.mockReturnValue(new Promise((resolve) => { resolveProfile = resolve }))
    const pending = refreshAccountPresentation({} as never, 'user-1', true, false)
    clearAccountPresentation()
    resolveProfile({ displayName: 'Stale', address: '', latitude: null, longitude: null, description: '', avatarPath: null })
    await pending
    expect(accountPresentation.userId).toBeNull()
  })
})
