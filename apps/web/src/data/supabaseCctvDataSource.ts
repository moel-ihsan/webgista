import type { SupabaseClient } from '@supabase/supabase-js'

import type { CctvDataSource } from './contracts'
import type { AgencySummary, CctvCategory, CctvLocation } from '../domain/cctv'
import { privateImageUrl } from './privateMedia'
import { appConfig } from '../config/app'
import { latestTrafficConditionSnapshots, listLatestTrafficObservations } from './trafficObservations'
import { listLatestV1RoiConditions, mergeExperimentalRoiConditions, type MarkerConditionSnapshot } from './roiV1MarkerCondition'
import { enforceLiveDemoNoData } from './liveDemoStreams'

const PUBLIC_FIELDS = 'id,name,address,category,agency_id,agency_name,longitude,latitude,snapshot_path'
const AUTHENTICATED_FIELDS = 'id,name,address,category,agency_id,longitude,latitude,snapshot_path,is_active,agency:agencies(id,name)'

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function coordinate(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && !value.trim()) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function agencySummary(row: Record<string, unknown>): AgencySummary | null {
  const agency = record(row.agency)
  const id = text(row.agency_id) ?? text(agency?.id)
  const name = text(row.agency_name) ?? text(agency?.name)
  return id && name ? { id, name } : null
}

export function mapCctvLocation(value: unknown): CctvLocation | null {
  const row = record(value)
  if (!row) return null

  const id = text(row.id)
  const name = text(row.name)
  const agency = agencySummary(row)
  const longitude = coordinate(row.longitude)
  const latitude = coordinate(row.latitude)
  const category = row.category

  if (
    !id || !name || !agency || longitude === null || latitude === null ||
    longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90 ||
    (category !== 'regular' && category !== 'analytic') || row.is_active === false
  ) return null

  return enforceLiveDemoNoData({
    id,
    legacyId: null,
    agency,
    name,
    address: text(row.address) ?? '',
    category: category as CctvCategory,
    longitude,
    latitude,
    snapshotUrl: text(row.snapshot_path),
    publicStreamUrl: null,
    isActive: true,
  })
}

export function createSupabaseCctvDataSource(client: SupabaseClient): CctvDataSource {
  return {
    async listLocations(signal?: AbortSignal): Promise<readonly CctvLocation[]> {
      const { data: sessionResult, error: sessionError } = await client.auth.getSession()
      if (signal?.aborted) return []
      if (sessionError) throw new Error('CCTV locations could not be loaded.')

      const query = sessionResult.session
        ? client
            .from('cctv_locations')
            .select(AUTHENTICATED_FIELDS)
            .eq('is_active', true)
        : client
            .from('public_cctv_locations')
            .select(PUBLIC_FIELDS)
      const result = signal ? await query.abortSignal(signal) : await query

      if (signal?.aborted) return []
      if (result.error) throw new Error('CCTV locations could not be loaded.')
      if (!Array.isArray(result.data)) throw new Error('CCTV locations could not be loaded.')

      let locations = result.data.map(mapCctvLocation).filter((location): location is CctvLocation => location !== null)
      if (sessionResult.session) {
        try {
          let conditions: ReadonlyMap<string, MarkerConditionSnapshot> = latestTrafficConditionSnapshots(await listLatestTrafficObservations(client, signal))
          if (appConfig.roiAnalysisEnabled) {
            try {
              const roiConditions = await listLatestV1RoiConditions(client, locations.map(({ id }) => id), signal)
              conditions = mergeExperimentalRoiConditions(conditions, roiConditions)
            } catch {
              // Keep authorized saved observations if experimental analysis is temporarily unavailable.
            }
          }
          locations = locations.map((location) => ({
            ...location,
            trafficCondition: conditions.get(location.id)?.condition ?? null,
            trafficConditionSource: conditions.get(location.id)?.source ?? null,
          })).map(enforceLiveDemoNoData)
        } catch {
          locations = locations.map((location) => enforceLiveDemoNoData({ ...location, trafficCondition: null, trafficConditionSource: null }))
        }
      }
      const withImages = appConfig.privateMediaEnabled
        ? await Promise.all(locations.map(async (location) => ({
          ...location,
          snapshotUrl: await privateImageUrl(client, 'cctv-images', location.snapshotUrl).catch(() => null),
        })))
        : locations.map((location) => ({ ...location, snapshotUrl: null }))
      return signal?.aborted ? [] : withImages
    },
  }
}
