import type { SupabaseClient } from '@supabase/supabase-js'

import type { TrafficCondition } from '../domain/traffic'

const DEMO_SOURCES = [
  { id: 'traffic_sample_01', uri: '/traffic-demo/traffic_sample_01_annotated.mp4', hash: '84066ad4f0302f105cd28dbaef2f00a72f62b2ad4760c1030dc11efc7dd078c4' },
  { id: 'traffic_sample_02', uri: '/traffic-demo/traffic_sample_02_annotated.mp4', hash: '88f571acbd0f502f82c3e0f02a8f977ecf4a23f56debe68533f6026050a490ca' },
] as const

export type MarkerConditionSnapshot = { condition: TrafficCondition | null; source: 'manual' | 'traffic_observation' | 'experimental_v1_estimate' }

export function mergeExperimentalRoiConditions(
  saved: ReadonlyMap<string, MarkerConditionSnapshot>,
  experimental: ReadonlyMap<string, MarkerConditionSnapshot>,
): ReadonlyMap<string, MarkerConditionSnapshot> {
  return new Map([...saved, ...experimental])
}

type RoiWindow = {
  window_started_at_seconds: number
  window_ended_at_seconds: number
  window_duration_seconds: number
  status: string
  traffic_category_statistics: Record<'LV' | 'HV' | 'MC', { average: number | null }>
  data_quality: { valid_samples: number; effective_observation_seconds: number; valid_observation_coverage: number }
}

export function v1RoiRatio(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null
  const window = value as Partial<RoiWindow>
  if (window.status !== 'complete' || window.window_duration_seconds !== 10 ||
      !window.data_quality || window.data_quality.valid_samples < 50 ||
      window.data_quality.effective_observation_seconds < 10 || window.data_quality.valid_observation_coverage < 0.9 ||
      !window.traffic_category_statistics) return null

  const { LV, HV, MC } = window.traffic_category_statistics
  const counts = [LV?.average, HV?.average, MC?.average]
  if (counts.some((count) => typeof count !== 'number' || !Number.isFinite(count) || count < 0)) return null

  // V1 constants and denominator, applied to the 10-second ROI mean as an experimental compatibility estimate.
  return (LV.average! * 0.1 + HV.average! * 0.13 + MC.average! * 0.04) / (4455 / 3600)
}

export function classifyV1RoiWindow(value: unknown): TrafficCondition | null {
  const ratio = v1RoiRatio(value)
  if (ratio === null || !Number.isFinite(ratio) || ratio < 0) return null
  if (ratio <= 0.6) return 'great'
  if (ratio <= 0.7) return 'good'
  if (ratio <= 0.8) return 'average'
  if (ratio <= 0.9) return 'poor'
  if (ratio <= 1) return 'bad'
  return 'terrible'
}

export function latestV1RoiConditions(
  jobs: readonly unknown[],
  configs: readonly unknown[],
  associations: readonly unknown[],
): ReadonlyMap<string, MarkerConditionSnapshot> {
  const versions = new Map(configs.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    return typeof row.cctv_id === 'string' && Number.isInteger(row.configuration_version)
      ? [[row.cctv_id, row.configuration_version] as const] : []
  }))
  const sourceForCamera = new Map(associations.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    const source = DEMO_SOURCES.find(({ uri }) => uri === row.source_uri)
    return row.source_kind === 'stored_clip' && typeof row.cctv_id === 'string' && source
      ? [[row.cctv_id, source] as const] : []
  }))

  const snapshots = new Map<string, { condition: TrafficCondition | null; source: 'experimental_v1_estimate'; endedAt: number; finishedAt: number }>()
  for (const item of jobs) {
    if (!item || typeof item !== 'object') continue
    const job = item as Record<string, unknown>
    if (job.status !== 'completed' || job.analysis_method_version !== 'roi_density_v1' ||
        typeof job.cctv_id !== 'string' || typeof job.source_video_identifier !== 'string' ||
        typeof job.source_video_sha256 !== 'string' || typeof job.configuration_version !== 'number' ||
        typeof job.finished_at !== 'string') continue
    const source = sourceForCamera.get(job.cctv_id)
    if (!source || source.id !== job.source_video_identifier || source.hash !== job.source_video_sha256 ||
        versions.get(job.cctv_id) !== job.configuration_version) continue
    const finishedAt = Date.parse(job.finished_at)
    if (!Number.isFinite(finishedAt)) continue
    const results = Array.isArray(job.cctv_roi_analysis_results) ? job.cctv_roi_analysis_results : []
    let candidate: { condition: TrafficCondition | null; endedAt: number } = { condition: null, endedAt: -1 }
    for (const result of results) {
      if (!result || typeof result !== 'object') continue
      const row = result as Record<string, unknown>
      if (typeof row.job_id !== 'string' || row.job_id !== job.id || typeof row.window_ended_at_seconds !== 'number') continue
      if (typeof row.summary !== 'object' || row.summary === null || (row.summary as Record<string, unknown>).status !== 'complete' || (row.summary as Record<string, unknown>).window_duration_seconds !== 10) continue
      if (row.window_ended_at_seconds <= candidate.endedAt) continue
      const condition = classifyV1RoiWindow(row.summary)
      candidate = { condition, endedAt: row.window_ended_at_seconds }
    }
    const current = snapshots.get(job.cctv_id)
    if (current && (finishedAt < current.finishedAt || (finishedAt === current.finishedAt && candidate.endedAt <= current.endedAt))) continue
    snapshots.set(job.cctv_id, { ...candidate, source: 'experimental_v1_estimate', finishedAt })
  }
  return new Map([...snapshots].map(([id, { condition, source }]) => [id, { condition, source }]))
}

export async function listLatestV1RoiConditions(
  client: SupabaseClient,
  cameraIds: readonly string[],
  signal?: AbortSignal,
): Promise<ReadonlyMap<string, MarkerConditionSnapshot>> {
  if (cameraIds.length === 0) return new Map()
  const sourceIds = DEMO_SOURCES.map(({ id }) => id)
  const sourceUris = DEMO_SOURCES.map(({ uri }) => uri)
  let associationQuery = client.from('cctv_private_config').select('cctv_id,source_kind,source_uri').in('cctv_id', [...cameraIds])
    .eq('source_kind', 'stored_clip').in('source_uri', sourceUris)
  if (signal) associationQuery = associationQuery.abortSignal(signal)
  const { data: associations, error: associationError } = await associationQuery
  if (signal?.aborted) return new Map()
  if (associationError) throw new Error('ROI marker estimates could not be loaded.')
  const associatedCameraIds = [...new Set((associations ?? []).flatMap((row) => typeof row.cctv_id === 'string' ? [row.cctv_id] : []))]
  if (associatedCameraIds.length === 0) return new Map()
  let configQuery = client.from('cctv_analysis_config').select('cctv_id,configuration_version').in('cctv_id', associatedCameraIds)
  let jobQuery = client.from('cctv_roi_analysis_jobs').select('id,cctv_id,source_video_identifier,source_video_sha256,configuration_version,analysis_method_version,status,finished_at')
    .in('cctv_id', associatedCameraIds).in('source_video_identifier', sourceIds).eq('status', 'completed')
    .eq('analysis_method_version', 'roi_density_v1').order('finished_at', { ascending: false }).limit(500)
  if (signal) {
    configQuery = configQuery.abortSignal(signal)
    jobQuery = jobQuery.abortSignal(signal)
  }
  const [configResult, jobResult] = await Promise.all([configQuery, jobQuery])
  if (signal?.aborted) return new Map()
  if (configResult.error || jobResult.error) throw new Error('ROI marker estimates could not be loaded.')
  const jobs = jobResult.data ?? []
  if (jobs.length === 0) return new Map()
  let resultsQuery = client.from('cctv_roi_analysis_results').select('job_id,window_ended_at_seconds,summary')
    .in('job_id', jobs.map((job) => job.id))
  if (signal) resultsQuery = resultsQuery.abortSignal(signal)
  const resultResult = await resultsQuery
  if (signal?.aborted) return new Map()
  if (resultResult.error) throw new Error('ROI marker estimates could not be loaded.')
  const resultsByJob = new Map<string, unknown[]>()
  for (const result of resultResult.data ?? []) {
    const rows = resultsByJob.get(result.job_id) ?? []
    rows.push(result)
    resultsByJob.set(result.job_id, rows)
  }
  return latestV1RoiConditions(jobs.map((job) => ({
    ...job,
    cctv_roi_analysis_results: resultsByJob.get(job.id) ?? [],
  })), configResult.data ?? [], associations ?? [])
}
