import type { RoiDensityConfig } from './roiDensity'

export type RoiDensityResultStatus = 'complete' | 'partial'
export type RoiDensityClassificationStatus =
  | 'no_data'
  | 'insufficient_duration'
  | 'insufficient_coverage'

export interface RoiDensityWindow {
  window_started_at_seconds: number
  window_ended_at_seconds: number
  window_duration_seconds: number
  status: RoiDensityResultStatus
  condition: 'great' | 'good' | 'average' | 'poor' | 'bad' | 'terrible' | null
  classification_status: RoiDensityClassificationStatus
  condition_reason: string
  average_vehicles_present: number | null
  peak_vehicles_present: number | null
  class_statistics: Record<'car' | 'bus' | 'truck' | 'motorcycle' | 'bicycle', { average: number | null; peak: number }>
  traffic_category_statistics: Record<'LV' | 'HV' | 'MC' | 'bicycle', { average: number | null; peak: number }>
  busy_duration_seconds: number
  busy_duration_percentage: number | null
  roi_image_coverage_average: number | null
  data_quality: {
    expected_samples: number
    valid_samples: number
    missing_samples: number
    effective_observation_seconds: number
    valid_observation_coverage: number
    processing_fps: number
    sample_period_seconds: number
  }
}

export interface RoiDensityResult {
  schema_version: 'webgista.roi-density-result.v1'
  analysis_method: 'roi_density_v1'
  traffic_condition_method: 'mkji_vc'
  provenance: {
    camera_id?: string
    source_video_identifier: string
    source_video_sha256: string
    is_live_cctv: boolean
    record_kind: string
    model: { name: string; version?: string; sha256?: string } | null
    detections_reused_from: string
    sampled_fps?: number
  }
  input_duration_seconds: number
  configuration_version: number
  configuration_snapshot: RoiDensityConfig & { camera_id?: string }
  roi_type: 'rectangle' | 'polygon'
  roi_geometry: number[] | [number, number][]
  video_dimensions: { width: number; height: number }
  observation_window_seconds: number
  refresh_seconds: number
  sampled_fps: number
  minimum_detection_confidence: number
  calibration_status: 'uncalibrated' | 'experimental' | 'calibrated'
  density_thresholds: number[] | null
  threshold_metric: string
  sampled_frame_metrics: Array<{
    timestamp_seconds: number
    vehicle_presence_by_class: Record<'car' | 'bus' | 'truck' | 'motorcycle' | 'bicycle', number>
    vehicle_presence_total: number
    roi_image_coverage: number | null
  }>
  windows: RoiDensityWindow[]
}

export function roiDensityFrameAt(result: RoiDensityResult, seconds: number): RoiDensityResult['sampled_frame_metrics'][number] | null {
  let current: RoiDensityResult['sampled_frame_metrics'][number] | null = null
  for (const frame of result.sampled_frame_metrics) {
    if (frame.timestamp_seconds > seconds) break
    current = frame
  }
  return current
}
