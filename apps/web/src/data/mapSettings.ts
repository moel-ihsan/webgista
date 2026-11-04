import type { SupabaseClient } from '@supabase/supabase-js'

export interface MapViewport {
  latitude: number
  longitude: number
  zoom: number
}

export const DEFAULT_MAP_VIEWPORT: Readonly<MapViewport> = Object.freeze({
  latitude: 5.5483,
  longitude: 95.3238,
  zoom: 11.2,
})

export function validateMapViewport(viewport: MapViewport): string | null {
  if (!Number.isFinite(viewport.latitude) || viewport.latitude < -90 || viewport.latitude > 90) return 'Latitude must be between -90 and 90.'
  if (!Number.isFinite(viewport.longitude) || viewport.longitude < -180 || viewport.longitude > 180) return 'Longitude must be between -180 and 180.'
  if (!Number.isFinite(viewport.zoom) || viewport.zoom < 8 || viewport.zoom > 18) return 'Zoom must be between 8 and 18.'
  return null
}

function mapViewport(row: unknown): MapViewport | null {
  if (!row || typeof row !== 'object') return null
  const value = row as Record<string, unknown>
  const viewport = { latitude: Number(value.latitude), longitude: Number(value.longitude), zoom: Number(value.zoom) }
  return validateMapViewport(viewport) ? null : viewport
}

export async function loadMapViewport(client: SupabaseClient, signal?: AbortSignal): Promise<MapViewport | null> {
  let query = client.from('app_map_settings').select('latitude,longitude,zoom').eq('id', 1)
  if (signal) query = query.abortSignal(signal)
  const { data, error } = await query.maybeSingle()
  if (error) throw new Error('Saved map settings could not be loaded.')
  const viewport = mapViewport(data)
  if (data && !viewport) throw new Error('Saved map settings contain invalid values.')
  return viewport
}

export async function saveMapViewport(client: SupabaseClient, viewport: MapViewport): Promise<MapViewport> {
  const validation = validateMapViewport(viewport)
  if (validation) throw new Error(validation)
  const { data, error } = await client.from('app_map_settings')
    .upsert({ id: 1, latitude: viewport.latitude, longitude: viewport.longitude, zoom: viewport.zoom }, { onConflict: 'id' })
    .select('latitude,longitude,zoom')
    .single()
  if (error) throw new Error(error.code === '42501' ? 'Only an administrator can save application map settings.' : 'Map settings could not be saved.')
  const saved = mapViewport(data)
  if (!saved) throw new Error('The saved map settings could not be confirmed.')
  return saved
}
