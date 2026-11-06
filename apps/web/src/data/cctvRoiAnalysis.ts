import type { SupabaseClient } from '@supabase/supabase-js'

export type RoiAnalysisJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'superseded'

export interface RoiAnalysisResult {
  window_started_at_seconds: number
  window_ended_at_seconds: number
  window_duration_seconds: number
  status: 'complete' | 'partial'
  classification_status: 'no_data' | 'insufficient_duration' | 'insufficient_coverage'
  condition: 'great' | 'good' | 'average' | 'poor' | 'bad' | 'terrible' | null
  condition_reason: string
  average_vehicles_present: number | null
  peak_vehicles_present: number | null
  class_statistics: Record<string, { average: number | null; peak: number }>
  traffic_category_statistics: Record<'LV' | 'HV' | 'MC' | 'bicycle', { average: number | null; peak: number }>
  roi_image_coverage_average: number | null
  busy_duration_seconds: number
  busy_duration_percentage: number | null
  data_quality: { expected_samples: number; valid_samples: number; missing_samples: number; effective_observation_seconds: number; valid_observation_coverage: number; processing_fps: number; sample_period_seconds: number }
}

export interface CurrentRoiAnalysis {
  jobId: string
  status: RoiAnalysisJobStatus
  failureReason: string | null
  results: RoiAnalysisResult[]
}

export async function scheduleCctvRoiAnalysis(client: SupabaseClient, cameraId: string): Promise<{ job_id: string; status: RoiAnalysisJobStatus; reason?: string }> {
  const { data, error } = await client.functions.invoke('process-roi-analysis', { body: { camera_id: cameraId } })
  if (error) throw new Error('ROI was saved, but analysis scheduling failed. Retry from Edit CCTV.')
  if (!data?.job_id || !['pending', 'processing', 'completed', 'failed', 'superseded'].includes(data.status)) {
    throw new Error('ROI was saved, but the analysis service returned an invalid status.')
  }
  return data as { job_id: string; status: RoiAnalysisJobStatus; reason?: string }
}

export async function getCurrentCctvRoiAnalysis(
  client: SupabaseClient,
  cameraId: string,
  sourceVideoIdentifier: string,
  sourceVideoHash: string,
  configurationVersion: number,
): Promise<CurrentRoiAnalysis | null> {
  const { data: job, error } = await client.from('cctv_roi_analysis_jobs').select('id,status,failure_reason,configuration_version')
    .eq('cctv_id', cameraId).eq('source_video_identifier', sourceVideoIdentifier)
    .eq('source_video_sha256', sourceVideoHash).eq('configuration_version', configurationVersion)
    .eq('analysis_method_version', 'roi_density_v1').order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (error) throw new Error('Saved analysis status is unavailable.')
  if (!job) {
    const { data: previous, error: previousError } = await client.from('cctv_roi_analysis_jobs').select('id,status,failure_reason,configuration_version')
      .eq('cctv_id', cameraId).eq('source_video_identifier', sourceVideoIdentifier)
      .eq('source_video_sha256', sourceVideoHash).eq('analysis_method_version', 'roi_density_v1')
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (previousError) throw new Error('Saved analysis status is unavailable.')
    if (!previous || previous.configuration_version === configurationVersion) return null
    return { jobId: previous.id as string, status: 'superseded', failureReason: 'Saved ROI changed; results from the previous configuration are hidden.', results: [] }
  }
  let results: RoiAnalysisResult[] = []
  if (job.status === 'completed') {
    const { data, error: resultError } = await client.from('cctv_roi_analysis_results').select('summary')
      .eq('job_id', job.id).order('window_started_at_seconds')
    if (resultError) throw new Error('Saved analysis results are unavailable.')
    results = (data ?? []).map((row) => row.summary as RoiAnalysisResult)
  }
  return { jobId: job.id, status: job.status as RoiAnalysisJobStatus, failureReason: job.failure_reason as string | null, results }
}
