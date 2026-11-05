import type { SupabaseClient } from '@supabase/supabase-js'

import type { TrafficCondition, TrafficObservation } from '../domain/traffic'

const CONDITIONS: readonly TrafficCondition[] = ['great', 'good', 'average', 'poor', 'bad', 'terrible']

export interface ManualObservationInput {
  cctvId: string
  condition: TrafficCondition
  lightVehicleCount: number
  heavyVehicleCount: number
  motorcycleCount: number
  bicycleCount: number
}

function mapObservation(value: unknown): TrafficObservation | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (typeof row.id !== 'string' || typeof row.cctv_id !== 'string' ||
      typeof row.window_started_at !== 'string' || typeof row.window_ended_at !== 'string' ||
      (row.condition !== null && !CONDITIONS.includes(row.condition as TrafficCondition)) ||
      !['manual', 'frame_detections', 'tracked_line_crossings'].includes(String(row.counting_method)) ||
      !['browser', 'worker', 'manual', 'v1_import'].includes(String(row.source_kind))) return null
  const integer = (key: string) => Number.isInteger(row[key]) && Number(row[key]) >= 0 ? Number(row[key]) : null
  const lightVehicleCount = integer('light_vehicle_count')
  const heavyVehicleCount = integer('heavy_vehicle_count')
  const motorcycleCount = integer('motorcycle_count')
  const bicycleCount = integer('bicycle_count')
  const sampledFrames = integer('sampled_frames')
  if (lightVehicleCount === null || heavyVehicleCount === null || motorcycleCount === null || bicycleCount === null || sampledFrames === null) return null
  return {
    id: row.id,
    cctvId: row.cctv_id,
    windowStartedAt: row.window_started_at,
    windowEndedAt: row.window_ended_at,
    condition: row.condition as TrafficCondition | null,
    countingMethod: row.counting_method === 'manual' ? 'manual' : row.counting_method === 'tracked_line_crossings' ? 'tracked_line_crossings' : 'frame_detections',
    sourceKind: row.source_kind as TrafficObservation['sourceKind'],
    lightVehicleCount,
    heavyVehicleCount,
    motorcycleCount,
    bicycleCount,
    sampledFrames,
    qualityFlags: Array.isArray(row.quality_flags) ? row.quality_flags.filter((flag): flag is string => typeof flag === 'string') : [],
  }
}

export function validateManualObservation(input: ManualObservationInput): string | null {
  if (!input.cctvId) return 'Select a CCTV location.'
  if (!CONDITIONS.includes(input.condition)) return 'Select a supported traffic condition.'
  if ([input.lightVehicleCount, input.heavyVehicleCount, input.motorcycleCount, input.bicycleCount]
    .some((count) => !Number.isInteger(count) || count < 0 || count > 1_000_000)) return 'Vehicle counts must be whole numbers between 0 and 1,000,000.'
  return null
}

export async function listTrafficObservations(client: SupabaseClient, cctvId?: string): Promise<readonly TrafficObservation[]> {
  let query = client.from('traffic_observations')
    .select('id,cctv_id,window_started_at,window_ended_at,counting_method,source_kind,condition,light_vehicle_count,heavy_vehicle_count,motorcycle_count,bicycle_count,sampled_frames,quality_flags')
    .eq('processing_status', 'completed')
    .order('window_ended_at', { ascending: false })
    .limit(500)
  if (cctvId) query = query.eq('cctv_id', cctvId)
  const { data, error } = await query
  if (error) throw new Error('Traffic observations could not be loaded. Check your access and connection.')
  if (!Array.isArray(data)) throw new Error('Traffic observations returned an invalid response.')
  return data.map(mapObservation).filter((row): row is TrafficObservation => row !== null)
}

export async function listLatestTrafficObservations(client: SupabaseClient): Promise<readonly TrafficObservation[]> {
  const { data, error } = await client.from('latest_traffic_observations')
    .select('id,cctv_id,window_started_at,window_ended_at,counting_method,source_kind,condition,light_vehicle_count,heavy_vehicle_count,motorcycle_count,bicycle_count,sampled_frames,quality_flags')
  if (error) throw new Error('Latest traffic observations could not be loaded.')
  if (!Array.isArray(data)) throw new Error('Latest traffic observations returned an invalid response.')
  return data.map(mapObservation).filter((row): row is TrafficObservation => row !== null)
}

export async function createManualTrafficObservation(client: SupabaseClient, input: ManualObservationInput): Promise<void> {
  const validation = validateManualObservation(input)
  if (validation) throw new Error(validation)
  const ended = new Date()
  const started = new Date(ended.getTime() - 5 * 60_000)
  const { error } = await client.from('traffic_observations').insert({
    cctv_id: input.cctvId,
    window_started_at: started.toISOString(),
    window_ended_at: ended.toISOString(),
    counting_method: 'manual',
    processing_status: 'completed',
    source_kind: 'manual',
    condition: input.condition,
    light_vehicle_count: input.lightVehicleCount,
    heavy_vehicle_count: input.heavyVehicleCount,
    motorcycle_count: input.motorcycleCount,
    bicycle_count: input.bicycleCount,
    sampled_frames: 0,
  })
  if (error) throw new Error(error.code === '42501' ? 'Your account cannot record an observation for this camera.' : 'Traffic observation could not be saved.')
}

export function latestTrafficConditions(observations: readonly TrafficObservation[]): ReadonlyMap<string, TrafficCondition> {
  const latest = new Map<string, TrafficCondition>()
  for (const observation of observations) {
    if (observation.condition && !latest.has(observation.cctvId)) latest.set(observation.cctvId, observation.condition)
  }
  return latest
}
