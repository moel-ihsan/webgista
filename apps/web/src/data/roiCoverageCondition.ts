import type { SupabaseClient } from '@supabase/supabase-js'

import type { TrafficCondition } from '../domain/traffic'
import { appConfig } from '../config/app'
import { listLatestTrafficObservations } from './trafficObservations'

export interface ConditionSnapshot {
  condition: TrafficCondition
  source: 'manual' | 'traffic_observation' | 'experimental_roi_coverage'
  observedAt: string
}

export function conditionFromRoiCoverage(value: unknown): TrafficCondition | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) return null
  if (value < 0.6) return 'great'
  if (value < 0.7) return 'good'
  if (value < 0.8) return 'average'
  if (value < 0.9) return 'poor'
  if (value < 1) return 'bad'
  return 'terrible'
}

export function latestRoiCoverageConditions(value: unknown): ReadonlyMap<string, ConditionSnapshot> {
  const rows = Array.isArray(value) ? value : []
  const latest = new Map<string, { condition: TrafficCondition; source: 'experimental_roi_coverage'; observedAt: string; finishedAt: number; windowEnd: number }>()
  for (const candidate of rows) {
    if (!candidate || typeof candidate !== 'object') continue
    const job = candidate as Record<string, unknown>
    if (job.status !== 'completed' || job.analysis_method_version !== 'roi_density_v1' || typeof job.cctv_id !== 'string' || typeof job.finished_at !== 'string') continue
    const finishedAt = Date.parse(job.finished_at)
    if (!Number.isFinite(finishedAt)) continue
    const results = Array.isArray(job.cctv_roi_analysis_results) ? job.cctv_roi_analysis_results : []
    for (const resultValue of results) {
      if (!resultValue || typeof resultValue !== 'object') continue
      const result = resultValue as Record<string, unknown>
      if (result.job_id !== job.id || typeof result.window_ended_at_seconds !== 'number' || !Number.isFinite(result.window_ended_at_seconds)) continue
      if (typeof result.summary !== 'object' || result.summary === null) continue
      const summary = result.summary as Record<string, unknown>
      if (summary.configuration_version !== job.configuration_version || summary.source_video_identifier !== job.source_video_identifier || summary.source_video_sha256 !== job.source_video_sha256) continue
      if (summary.status !== 'complete' || typeof summary.data_quality !== 'object' || summary.data_quality === null) continue
      const quality = summary.data_quality as Record<string, unknown>
      if (typeof quality.valid_observation_coverage !== 'number' || quality.valid_observation_coverage < 0.8) continue
      const condition = conditionFromRoiCoverage(summary.roi_image_coverage_average)
      if (!condition) continue
      const current = latest.get(job.cctv_id)
      if (!current || finishedAt > current.finishedAt || (finishedAt === current.finishedAt && result.window_ended_at_seconds > current.windowEnd)) {
        latest.set(job.cctv_id, { condition, source: 'experimental_roi_coverage', observedAt: job.finished_at, finishedAt, windowEnd: result.window_ended_at_seconds })
      }
    }
  }
  return latest
}

export function latestAuthorizedConditionSnapshots(
  observations: readonly import('../domain/traffic').TrafficObservation[],
  roiConditions: ReadonlyMap<string, ConditionSnapshot>,
): ReadonlyMap<string, ConditionSnapshot> {
  const latest = new Map<string, ConditionSnapshot>()
  for (const observation of observations) {
    const endedAt = Date.parse(observation.windowEndedAt)
    if (!observation.condition || !Number.isFinite(endedAt)) continue
    const current = latest.get(observation.cctvId)
    if (current && endedAt <= Date.parse(current.observedAt)) continue
    latest.set(observation.cctvId, {
      condition: observation.condition,
      source: observation.sourceKind === 'manual' ? 'manual' : 'traffic_observation',
      observedAt: observation.windowEndedAt,
    })
  }
  for (const [cameraId, candidate] of roiConditions) {
    const current = latest.get(cameraId)
    if (!current || Date.parse(candidate.observedAt) > Date.parse(current.observedAt)) latest.set(cameraId, candidate)
  }
  return latest
}

export async function listLatestCctvConditionSnapshots(
  client: SupabaseClient,
  signal?: AbortSignal,
): Promise<ReadonlyMap<string, ConditionSnapshot>> {
  const [observations, roiConditions] = await Promise.all([
    listLatestTrafficObservations(client, signal),
    appConfig.roiAnalysisEnabled ? listLatestRoiCoverageConditions(client, signal) : Promise.resolve(new Map<string, ConditionSnapshot>()),
  ])
  return latestAuthorizedConditionSnapshots(observations, roiConditions)
}

export async function listLatestRoiCoverageConditions(
  client: SupabaseClient,
  signal?: AbortSignal,
): Promise<ReadonlyMap<string, ConditionSnapshot>> {
  let query = client.from('cctv_roi_analysis_jobs').select(
    'id,cctv_id,source_video_identifier,source_video_sha256,configuration_version,analysis_method_version,status,finished_at,cctv_roi_analysis_results(job_id,window_ended_at_seconds,summary)',
  ).eq('status', 'completed').eq('analysis_method_version', 'roi_density_v1').order('finished_at', { ascending: false }).limit(500)
  if (signal) query = query.abortSignal(signal)
  const { data, error } = await query
  if (error) throw new Error('Latest ROI analysis conditions could not be loaded.')
  return latestRoiCoverageConditions(data)
}
