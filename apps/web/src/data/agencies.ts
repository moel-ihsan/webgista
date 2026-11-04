import type { SupabaseClient } from '@supabase/supabase-js'

import type { AppRole } from '../auth/types'

export interface Agency {
  id: string
  name: string
  isPublic: boolean
}

export async function listAgencies(
  client: SupabaseClient,
  role: AppRole | null,
  agencyIds: readonly string[] = [],
): Promise<readonly Agency[]> {
  if (!role || (role === 'agency_editor' && agencyIds.length === 0)) return []
  let query = client.from('agencies').select('id,name,is_public').order('name')
  if (role === 'agency_editor') query = query.in('id', [...agencyIds])
  const { data, error } = await query
  if (error) throw new Error('Agency list could not be loaded.')
  return (data ?? []).filter((row): row is { id: string; name: string; is_public: boolean } =>
    typeof row.id === 'string' && typeof row.name === 'string' && typeof row.is_public === 'boolean',
  ).map(({ id, name, is_public }) => ({ id, name, isPublic: is_public }))
}

export async function createAgency(client: SupabaseClient, name: string): Promise<Agency> {
  const trimmed = name.trim()
  if (trimmed.length < 2 || trimmed.length > 120) throw new Error('Agency name must be between 2 and 120 characters.')
  const { data, error } = await client.from('agencies').insert({ name: trimmed }).select('id,name,is_public').single()
  if (error) {
    if (error.code === '23505') throw new Error('An agency with this name already exists.')
    if (error.code === '42501') throw new Error('Only an administrator can add an agency.')
    throw new Error('Agency could not be added.')
  }
  if (!data || typeof data.id !== 'string' || typeof data.name !== 'string' || typeof data.is_public !== 'boolean') {
    throw new Error('The new agency could not be confirmed.')
  }
  return { id: data.id, name: data.name, isPublic: data.is_public }
}

export async function deleteAgency(client: SupabaseClient, id: string): Promise<boolean> {
  const { data, error } = await client.from('agencies').delete().eq('id', id).select('id').maybeSingle()
  if (error) {
    if (error.code === '23503') throw new Error('Agency is still referenced by CCTV records or memberships and cannot be removed.')
    if (error.code === '42501') throw new Error('Only an administrator can remove an agency.')
    throw new Error('Agency could not be removed.')
  }
  return typeof data?.id === 'string'
}
