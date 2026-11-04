import { describe, expect, it, vi } from 'vitest'

import { changeOwnPassword, getOwnProfile, profileCoordinates, updateOwnProfile, updateOwnProfilePhoto, validateProfile, type UserProfileInput } from './account'

const profile: UserProfileInput = { displayName: 'WebGISTA User', address: 'Banda Aceh', latitude: 5.55, longitude: 95.33, description: 'Research user' }

function profileClient(response: { data: unknown; error: unknown }) {
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), update: vi.fn() }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.update.mockReturnValue(query)
  query.maybeSingle.mockResolvedValue(response)
  return { client: { from: vi.fn().mockReturnValue(query) } as never, query }
}

describe('account profile data access', () => {
  it('reads only the authenticated user profile including v1 metadata and private avatar path', async () => {
    const mock = profileClient({ data: { user_id: 'user-1', display_name: profile.displayName, address: profile.address, latitude: profile.latitude, longitude: profile.longitude, description: profile.description, avatar_path: null }, error: null })
    await expect(getOwnProfile(mock.client, 'user-1')).resolves.toEqual({ ...profile, avatarPath: null })
    expect(mock.query.select).toHaveBeenCalledWith('user_id,display_name,address,latitude,longitude,description,avatar_path')
    expect(mock.query.eq).toHaveBeenCalledWith('user_id', 'user-1')
  })

  it('updates own editable fields only and validates coordinates and lengths', async () => {
    const mock = profileClient({ data: { user_id: 'user-1', display_name: profile.displayName, address: profile.address, latitude: profile.latitude, longitude: profile.longitude, description: profile.description }, error: null })
    await expect(updateOwnProfile(mock.client, 'user-1', profile)).resolves.toEqual(profile)
    expect(mock.query.update).toHaveBeenCalledWith({ display_name: 'WebGISTA User', address: 'Banda Aceh', latitude: 5.55, longitude: 95.33, description: 'Research user' })
    expect(mock.query.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(validateProfile({ ...profile, latitude: null })).toContain('both latitude and longitude')
    expect(validateProfile({ ...profile, longitude: 181 })).toContain('longitude')
    expect(validateProfile({ ...profile, description: 'x'.repeat(2001) })).toContain('2000')
    expect(profileCoordinates('5,559729', '95.330911')).toEqual({ latitude: 5.559729, longitude: 95.330911 })
    expect(() => profileCoordinates('north', '95,3,3')).toThrow('valid numeric')
    await expect(updateOwnProfile(profileClient({ data: null, error: null }).client, 'user-1', profile)).rejects.toThrow('No profile was updated')
  })
})

describe('password changes through Supabase Auth', () => {
  function authClient(userId: string, signInUserId = userId, signInError: unknown = null) {
    const auth = {
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: userId } } }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: { user: { id: signInUserId } }, error: signInError }),
      updateUser: vi.fn().mockResolvedValue({ error: null }),
    }
    return { client: { auth } as never, auth }
  }

  it('reauthenticates the same user before updating the password', async () => {
    const mock = authClient('user-1')
    await changeOwnPassword(mock.client, 'user-1', 'user@example.test', 'old-password', 'new-password')
    expect(mock.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'user@example.test', password: 'old-password' })
    expect(mock.auth.updateUser).toHaveBeenCalledWith({ password: 'new-password' })
  })

  it('rejects expired sessions, wrong current password, mismatched identities, and weak passwords', async () => {
    const expired = authClient('different-user')
    await expect(changeOwnPassword(expired.client, 'user-1', 'u@example.test', 'old-password', 'new-password')).rejects.toThrow('session has expired')
    const wrong = authClient('user-1', 'user-1', { message: 'denied' })
    await expect(changeOwnPassword(wrong.client, 'user-1', 'u@example.test', 'wrong', 'new-password')).rejects.toThrow('could not be verified')
    const otherUser = authClient('user-1', 'user-2')
    await expect(changeOwnPassword(otherUser.client, 'user-1', 'u@example.test', 'old-password', 'new-password')).rejects.toThrow('could not be verified')
    const weak = authClient('user-1')
    await expect(changeOwnPassword(weak.client, 'user-1', 'u@example.test', 'old-password', 'short')).rejects.toThrow('at least 8 characters')
    expect(weak.auth.signInWithPassword).not.toHaveBeenCalled()
  })
})

describe('private profile photo replacement', () => {
  function mediaClient(profileResult: { data: unknown; error: unknown }) {
    const query = { update: vi.fn(), eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn().mockResolvedValue(profileResult) }
    query.update.mockReturnValue(query); query.eq.mockReturnValue(query); query.select.mockReturnValue(query)
    const upload = vi.fn().mockResolvedValue({ error: null })
    const remove = vi.fn().mockResolvedValue({ error: null })
    const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: 'signed-profile-photo' }, error: null })
    const storage = { from: vi.fn(() => ({ upload, remove, createSignedUrl })) }
    return { client: { from: vi.fn(() => query), storage } as never, query, storage, upload, remove, createSignedUrl }
  }

  it("updates only the authenticated user's avatar path and replaces the old object after success", async () => {
    const mock = mediaClient({ data: { user_id: 'user-1' }, error: null })
    const image = { type: 'image/jpeg', size: 3, slice: () => ({ arrayBuffer: async () => new Uint8Array([255, 216, 255]).buffer }) } as unknown as File
    await expect(updateOwnProfilePhoto(mock.client, 'user-1', 'user-1/old.jpg', image)).resolves.toMatchObject({ path: expect.stringMatching(/^user-1\/[0-9a-f-]+\.jpg$/i), url: 'signed-profile-photo' })
    const path = mock.upload.mock.calls[0]?.[0]
    expect(mock.query.update).toHaveBeenCalledWith({ avatar_path: path })
    expect(mock.query.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(mock.remove).toHaveBeenCalledWith(['user-1/old.jpg'])
  })

  it('compensates for a denied profile pointer update by removing the new upload', async () => {
    const mock = mediaClient({ data: null, error: null })
    const image = { type: 'image/jpeg', size: 3, slice: () => ({ arrayBuffer: async () => new Uint8Array([255, 216, 255]).buffer }) } as unknown as File
    await expect(updateOwnProfilePhoto(mock.client, 'user-1', null, image)).rejects.toThrow('could not be saved')
    expect(mock.remove).toHaveBeenCalledWith([mock.upload.mock.calls[0]?.[0]])
    expect(mock.createSignedUrl).not.toHaveBeenCalled()
  })
})
