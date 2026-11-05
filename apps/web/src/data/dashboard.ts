import type { SupabaseClient } from '@supabase/supabase-js'

import { privateImageUrl } from './privateMedia'

export interface RecentCctv {
  id: string
  name: string
  address: string
  date: string
  isActive: boolean
  imageUrl: string | null
}

export function formatRecentDate(value: string): string {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return 'Date unavailable'
  const days = Math.floor((Date.now() - timestamp) / 86_400_000)
  if (days < 1) return 'Recently added'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

export async function listRecentlyAddedCctv(
  client: SupabaseClient,
  includePrivateImages: boolean,
  signal?: AbortSignal,
): Promise<readonly RecentCctv[]> {
  const { data: sessionResult, error: sessionError } = await client.auth.getSession()
  if (signal?.aborted) return []
  if (sessionError) throw new Error('Recently added CCTV could not be loaded.')
  const authenticated = Boolean(sessionResult.session)
  let query = authenticated
    ? client.from('cctv_locations').select('id,name,address,created_at,is_active,snapshot_path').order('created_at', { ascending: false })
    : client.from('public_cctv_locations').select('id,name,address,updated_at,snapshot_path').order('updated_at', { ascending: false })
  if (signal) query = query.abortSignal(signal)
  const { data, error } = await query
  if (error) throw new Error('Recently added CCTV could not be loaded.')
  if (!Array.isArray(data)) throw new Error('Recently added CCTV returned an invalid response.')

  const rows = (data as unknown[]).filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
    .filter((row) => typeof row.id === 'string' && typeof row.name === 'string'
      && typeof (authenticated ? row.created_at : row.updated_at) === 'string'
      && (!authenticated || typeof row.is_active === 'boolean'))
  const results = await Promise.all(rows.map(async (row): Promise<RecentCctv> => ({
    id: row.id as string,
    name: row.name as string,
    address: typeof row.address === 'string' ? row.address : '',
    date: (authenticated ? row.created_at : row.updated_at) as string,
    isActive: authenticated ? row.is_active as boolean : true,
    imageUrl: includePrivateImages && typeof row.snapshot_path === 'string'
      ? await privateImageUrl(client, 'cctv-images', row.snapshot_path).catch(() => null)
      : null,
  })))
  return signal?.aborted ? [] : results
}
