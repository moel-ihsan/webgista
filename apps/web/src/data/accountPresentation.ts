import { reactive } from 'vue'
import type { SupabaseClient } from '@supabase/supabase-js'

import { getOwnProfile, getOwnProfilePhotoUrl, type UserProfile } from './account'

export const accountPresentation = reactive<{
  userId: string | null
  profile: UserProfile | null
  photoUrl: string | null
}>({ userId: null, profile: null, photoUrl: null })

let requestId = 0

export async function refreshAccountPresentation(
  client: SupabaseClient,
  userId: string,
  includeLegacyFields: boolean,
  includePhoto: boolean,
): Promise<void> {
  const currentRequest = ++requestId
  try {
    const profile = await getOwnProfile(client, userId, includeLegacyFields)
    const photoUrl = includePhoto ? await getOwnProfilePhotoUrl(client, profile?.avatarPath ?? null).catch(() => null) : null
    if (currentRequest !== requestId) return
    accountPresentation.userId = userId
    accountPresentation.profile = profile
    accountPresentation.photoUrl = photoUrl
  } catch {
    if (currentRequest !== requestId) return
    accountPresentation.userId = userId
    accountPresentation.profile = null
    accountPresentation.photoUrl = null
  }
}

export function clearAccountPresentation(): void {
  requestId += 1
  accountPresentation.userId = null
  accountPresentation.profile = null
  accountPresentation.photoUrl = null
}
