import type { SupabaseClient } from '@supabase/supabase-js'

import type { AppRole } from '../auth/types'
import type { CctvCategory } from '../domain/cctv'
import { listAgencies } from './agencies'
import { privateImageUrl, removePrivateImage, uploadPrivateImage } from './privateMedia'

const LOCATION_FIELDS = 'id,name,address,category,agency_id,longitude,latitude,is_active,is_public,snapshot_path,updated_at,agency:agencies(id,name)'

export interface CctvManagementLocation {
  id: string
  name: string
  address: string
  category: CctvCategory
  agencyId: string
  agencyName: string | null
  longitude: number
  latitude: number
  isActive: boolean
  isPublic: boolean
  snapshotPath: string | null
  updatedAt: string
}

export interface CctvLocationInput {
  name: string
  address: string
  category: CctvCategory
  agencyId: string
  longitude: number
  latitude: number
}

export interface CctvAgencyOption {
  id: string
  name: string
}

export type CctvSortField = 'name' | 'address' | 'coordinate' | 'agency' | 'category'

export function sortCctvLocations(
  locations: readonly CctvManagementLocation[],
  field: CctvSortField,
  direction: 'ascending' | 'descending',
): readonly CctvManagementLocation[] {
  const sign = direction === 'ascending' ? 1 : -1
  return [...locations].sort((left, right) => {
    let comparison = 0
    if (field === 'coordinate') {
      comparison = left.longitude - right.longitude || left.latitude - right.latitude
    } else {
      const value = (location: CctvManagementLocation) => field === 'agency'
        ? location.agencyName ?? ''
        : location[field]
      comparison = value(left).localeCompare(value(right), undefined, { numeric: true, sensitivity: 'base' })
    }
    return comparison * sign
  })
}

export function searchCctvLocations(
  locations: readonly CctvManagementLocation[],
  query: string,
): readonly CctvManagementLocation[] {
  const normalized = query.trim().toLocaleLowerCase()
  return locations.filter((location) =>
    !normalized || [location.name, location.address, location.agencyName ?? '', location.category]
      .some((value) => value.toLocaleLowerCase().includes(normalized)),
  )
}

export function pageCctvLocations(
  locations: readonly CctvManagementLocation[],
  page: number,
  pageSize: number,
): readonly CctvManagementLocation[] {
  const size = Math.max(1, Math.floor(pageSize))
  const index = Math.max(0, Math.floor(page) - 1)
  return locations.slice(index * size, (index + 1) * size)
}

export function canManageCctvLocation(
  role: AppRole | null,
  agencyIds: readonly string[],
  location: Pick<CctvManagementLocation, 'agencyId'>,
): boolean {
  return role === 'administrator' || (role === 'agency_editor' && agencyIds.includes(location.agencyId))
}

export function validateCctvLocationInput(
  input: CctvLocationInput,
  allowedAgencyIds: readonly string[],
): string | null {
  if (input.name.trim().length < 2 || input.name.trim().length > 160) return 'Name must be between 2 and 160 characters.'
  if (input.address.trim().length < 2 || input.address.trim().length > 500) return 'Address must be between 2 and 500 characters.'
  if (input.category !== 'regular' && input.category !== 'analytic') return 'Select a supported camera category.'
  if (!Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180) return 'Enter a valid longitude between -180 and 180.'
  if (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90) return 'Enter a valid latitude between -90 and 90.'
  if (!allowedAgencyIds.includes(input.agencyId)) return 'Select an agency you are authorized to manage.'
  return null
}

function readableError(error: { code?: string } | null, action: string): Error {
  if (error?.code === '42501' || error?.code === 'PGRST301') return new Error('Your account is not authorized to perform this action.')
  if (error?.code === '23503') return new Error('This camera has related records and cannot be deleted.')
  return new Error(`CCTV ${action} failed. Please try again.`)
}

function mapLocation(value: unknown): CctvManagementLocation | null {
  if (typeof value !== 'object' || value === null) return null
  const row = value as Record<string, unknown>
  const agency = typeof row.agency === 'object' && row.agency !== null ? row.agency as Record<string, unknown> : null
  const longitude = Number(row.longitude)
  const latitude = Number(row.latitude)
  if (
    typeof row.id !== 'string' || typeof row.name !== 'string' || typeof row.address !== 'string' ||
    (row.category !== 'regular' && row.category !== 'analytic') || typeof row.agency_id !== 'string' ||
    !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
    !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
    typeof row.is_active !== 'boolean' || typeof row.is_public !== 'boolean' || typeof row.updated_at !== 'string' ||
    (row.snapshot_path != null && typeof row.snapshot_path !== 'string')
  ) return null

  return {
    id: row.id,
    name: row.name,
    address: row.address,
    category: row.category,
    agencyId: row.agency_id,
    agencyName: typeof agency?.name === 'string' ? agency.name : null,
    longitude,
    latitude,
    isActive: row.is_active,
    isPublic: row.is_public,
    snapshotPath: typeof row.snapshot_path === 'string' ? row.snapshot_path : null,
    updatedAt: row.updated_at,
  }
}

export async function listCctvLocations(client: SupabaseClient, signal?: AbortSignal): Promise<readonly CctvManagementLocation[]> {
  let query = client.from('cctv_locations').select(LOCATION_FIELDS).order('name')
  if (signal) query = query.abortSignal(signal)
  const { data, error } = await query
  if (error) throw readableError(error, 'list')
  if (!Array.isArray(data)) throw new Error('CCTV list returned an invalid response.')
  return data.map(mapLocation).filter((row): row is CctvManagementLocation => row !== null)
}

export async function getCctvLocation(
  client: SupabaseClient,
  id: string,
  signal?: AbortSignal,
): Promise<CctvManagementLocation | null> {
  const query = client.from('cctv_locations').select(LOCATION_FIELDS).eq('id', id)
  const result = signal ? await query.abortSignal(signal).maybeSingle() : await query.maybeSingle()
  const { data, error } = result
  if (error) throw readableError(error, 'load')
  return mapLocation(data)
}

export async function listCctvAgencies(
  client: SupabaseClient,
  role: AppRole | null,
  agencyIds: readonly string[],
): Promise<readonly CctvAgencyOption[]> {
  return (await listAgencies(client, role, agencyIds)).map(({ id, name }) => ({ id, name }))
}

export async function createCctvLocation(client: SupabaseClient, input: CctvLocationInput): Promise<string | null> {
  const { data, error } = await client.from('cctv_locations').insert({
    name: input.name.trim(),
    address: input.address.trim(),
    category: input.category,
    agency_id: input.agencyId,
    longitude: input.longitude,
    latitude: input.latitude,
  }).select('id').maybeSingle()
  if (error) throw readableError(error, 'create')
  return typeof data?.id === 'string' ? data.id : null
}

export async function getCctvSnapshotUrl(client: SupabaseClient, path: string | null): Promise<string | null> {
  return privateImageUrl(client, 'cctv-images', path)
}

export async function replaceCctvSnapshot(client: SupabaseClient, id: string, oldPath: string | null, file: File): Promise<{ path: string; url: string | null }> {
  const path = await uploadPrivateImage(client, 'cctv-images', id, file, 5 * 1024 * 1024)
  const { data, error } = await client.from('cctv_locations').update({ snapshot_path: path }).eq('id', id).select('id').maybeSingle()
  if (error || data?.id !== id) {
    await removePrivateImage(client, 'cctv-images', path).catch(() => undefined)
    throw new Error('Image could not be attached to this CCTV. Its existing image reference is unchanged.')
  }
  if (oldPath && oldPath !== path) await removePrivateImage(client, 'cctv-images', oldPath).catch(() => undefined)
  return { path, url: await privateImageUrl(client, 'cctv-images', path).catch(() => null) }
}

export async function updateCctvLocation(
  client: SupabaseClient,
  id: string,
  input: CctvLocationInput,
): Promise<boolean> {
  const { data, error } = await client.from('cctv_locations').update({
    name: input.name.trim(),
    address: input.address.trim(),
    category: input.category,
    agency_id: input.agencyId,
    longitude: input.longitude,
    latitude: input.latitude,
  }).eq('id', id).select('id').maybeSingle()
  if (error) throw readableError(error, 'update')
  return typeof data?.id === 'string'
}

export async function setCctvLocationActive(client: SupabaseClient, id: string, isActive: boolean): Promise<boolean> {
  const { data, error } = await client.from('cctv_locations').update({ is_active: isActive }).eq('id', id).select('id').maybeSingle()
  if (error) throw readableError(error, 'status update')
  return typeof data?.id === 'string'
}

export async function deleteCctvLocation(client: SupabaseClient, id: string): Promise<boolean> {
  const { data, error } = await client.from('cctv_locations').delete().eq('id', id).select('id').maybeSingle()
  if (error) throw readableError(error, 'delete')
  return typeof data?.id === 'string'
}
