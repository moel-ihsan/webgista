import type { SupabaseClient } from '@supabase/supabase-js'

import { parseCoordinate } from '../domain/coordinates'
import { privateImageUrl, removePrivateImage, uploadPrivateImage } from './privateMedia'

export interface UserProfile {
  displayName: string
  address: string
  latitude: number | null
  longitude: number | null
  description: string
  avatarPath: string | null
}

export type UserProfileInput = Omit<UserProfile, 'avatarPath'>

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function validateProfile(input: UserProfileInput): string | null {
  if (input.displayName.trim().length < 1 || input.displayName.trim().length > 120) return 'Name must be between 1 and 120 characters.'
  if (input.address.length > 500) return 'Address must be 500 characters or fewer.'
  if (input.description.length > 2000) return 'Description must be 2000 characters or fewer.'
  if ((input.latitude === null) !== (input.longitude === null)) return 'Enter both latitude and longitude, or leave both blank.'
  if (input.latitude !== null && (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90)) return 'Enter a valid latitude between -90 and 90.'
  if (input.longitude !== null && (!Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180)) return 'Enter a valid longitude between -180 and 180.'
  return null
}

export async function getOwnProfile(client: SupabaseClient, userId: string, includeLegacyFields = true): Promise<UserProfile | null> {
  const query = client.from('profiles')
  const result = includeLegacyFields
    ? await query.select('user_id,display_name,address,latitude,longitude,description,avatar_path').eq('user_id', userId).maybeSingle()
    : await query.select('user_id,display_name,avatar_path').eq('user_id', userId).maybeSingle()
  const data = result.data as unknown as Record<string, unknown> | null
  const { error } = result
  if (error) throw new Error('Profile could not be loaded.')
  if (!data || data.user_id !== userId || typeof data.display_name !== 'string') return null
  return {
    displayName: data.display_name,
    address: typeof data.address === 'string' ? data.address : '',
    latitude: optionalNumber(data.latitude),
    longitude: optionalNumber(data.longitude),
    description: typeof data.description === 'string' ? data.description : '',
    avatarPath: typeof data.avatar_path === 'string' ? data.avatar_path : null,
  }
}

export async function updateOwnProfile(client: SupabaseClient, userId: string, input: UserProfileInput, includeLegacyFields = true): Promise<UserProfileInput> {
  const validation = includeLegacyFields ? validateProfile(input) : (input.displayName.trim().length < 1 || input.displayName.trim().length > 120 ? 'Name must be between 1 and 120 characters.' : null)
  if (validation) throw new Error(validation)
  const value = { ...input, displayName: input.displayName.trim(), address: input.address.trim(), description: input.description.trim() }
  const changes = includeLegacyFields ? {
    display_name: value.displayName, address: value.address || null, latitude: value.latitude,
    longitude: value.longitude, description: value.description || null,
  } : { display_name: value.displayName }
  const query = client.from('profiles').update(changes).eq('user_id', userId)
  const result = includeLegacyFields
    ? await query.select('user_id,display_name,address,latitude,longitude,description').maybeSingle()
    : await query.select('user_id,display_name').maybeSingle()
  const data = result.data as unknown as Record<string, unknown> | null
  const { error } = result
  if (error) throw new Error('Profile could not be updated.')
  if (data?.user_id !== userId || typeof data.display_name !== 'string') throw new Error('No profile was updated. Check that your session is still valid.')
  if (!includeLegacyFields) return { ...input, displayName: data.display_name }
  return {
    displayName: data.display_name,
    address: typeof data.address === 'string' ? data.address : '',
    latitude: optionalNumber(data.latitude),
    longitude: optionalNumber(data.longitude),
    description: typeof data.description === 'string' ? data.description : '',
  }
}

export async function getOwnProfilePhotoUrl(client: SupabaseClient, path: string | null): Promise<string | null> {
  return privateImageUrl(client, 'profile-photos', path)
}

export async function updateOwnProfilePhoto(client: SupabaseClient, userId: string, oldPath: string | null, file: File): Promise<{ path: string; url: string | null }> {
  const path = await uploadPrivateImage(client, 'profile-photos', userId, file, 2 * 1024 * 1024)
  const { data, error } = await client.from('profiles').update({ avatar_path: path }).eq('user_id', userId).select('user_id').maybeSingle()
  if (error || data?.user_id !== userId) {
    await removePrivateImage(client, 'profile-photos', path).catch(() => undefined)
    throw new Error('Profile photo could not be saved.')
  }
  if (oldPath && oldPath !== path) await removePrivateImage(client, 'profile-photos', oldPath).catch(() => undefined)
  return { path, url: await privateImageUrl(client, 'profile-photos', path).catch(() => null) }
}

export async function changeOwnPassword(
  client: SupabaseClient,
  userId: string,
  email: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  if (!email) throw new Error('Your account does not have an email address for verification.')
  if (newPassword.length < 8) throw new Error('New password must contain at least 8 characters.')
  if (newPassword === currentPassword) throw new Error('Choose a new password different from your current password.')

  const { data: sessionData, error: sessionError } = await client.auth.getSession()
  if (sessionError || sessionData.session?.user.id !== userId) throw new Error('Your session has expired. Sign in again.')
  const { data, error } = await client.auth.signInWithPassword({ email, password: currentPassword })
  if (error || data.user?.id !== userId) throw new Error('Current password could not be verified.')
  const { error: updateError } = await client.auth.updateUser({ password: newPassword })
  if (updateError) throw new Error('Password could not be changed. Please try again.')
}

export function profileCoordinates(latitude: string, longitude: string): Pick<UserProfileInput, 'latitude' | 'longitude'> {
  if (!latitude.trim() && !longitude.trim()) return { latitude: null, longitude: null }
  const parsedLatitude = parseCoordinate(latitude)
  const parsedLongitude = parseCoordinate(longitude)
  if (parsedLatitude === null || parsedLongitude === null) throw new Error('Enter valid numeric coordinates.')
  return { latitude: parsedLatitude, longitude: parsedLongitude }
}
