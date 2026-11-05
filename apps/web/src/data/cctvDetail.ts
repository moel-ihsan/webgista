import type { SupabaseClient } from '@supabase/supabase-js'

import type { CctvCategory } from '../domain/cctv'

export interface CctvDetail {
  id: string
  name: string
  address: string
  category: CctvCategory
  agencyName: string | null
  longitude: number
  latitude: number
  snapshotPath: string | null
}

const PUBLIC_FIELDS = 'id,name,address,category,agency_name,longitude,latitude,snapshot_path'
const AUTHENTICATED_FIELDS = 'id,name,address,category,longitude,latitude,snapshot_path,agency:agencies(name)'

function coordinate(value: unknown): number | null {
  if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && !value.trim())) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function mapDetail(value: unknown): CctvDetail | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const agency = typeof row.agency === 'object' && row.agency !== null ? row.agency as Record<string, unknown> : null
  const longitude = coordinate(row.longitude)
  const latitude = coordinate(row.latitude)
  if (
    typeof row.id !== 'string' || typeof row.name !== 'string' || typeof row.address !== 'string' ||
    (row.category !== 'regular' && row.category !== 'analytic') ||
    longitude === null || longitude < -180 || longitude > 180 ||
    latitude === null || latitude < -90 || latitude > 90 ||
    (row.snapshot_path != null && typeof row.snapshot_path !== 'string')
  ) return null

  return {
    id: row.id,
    name: row.name,
    address: row.address,
    category: row.category as CctvCategory,
    agencyName: typeof row.agency_name === 'string' ? row.agency_name : typeof agency?.name === 'string' ? agency.name : null,
    longitude,
    latitude,
    snapshotPath: typeof row.snapshot_path === 'string' ? row.snapshot_path : null,
  }
}

export async function getCctvDetail(client: SupabaseClient, id: string, authenticated: boolean): Promise<CctvDetail | null> {
  const table = authenticated ? 'cctv_locations' : 'public_cctv_locations'
  const fields = authenticated ? AUTHENTICATED_FIELDS : PUBLIC_FIELDS
  const { data, error } = await client.from(table).select(fields).eq('id', id).maybeSingle()
  if (error) throw new Error('CCTV details could not be loaded. Check your access and connection.')
  return mapDetail(data)
}
