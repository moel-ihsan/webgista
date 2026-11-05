import sample01 from './traffic-demo/traffic_sample_01.analysis.json'
import sample02 from './traffic-demo/traffic_sample_02.analysis.json'
import sample01RoiDensity from './traffic-demo/traffic_sample_01.roi-density.json'
import sample02RoiDensity from './traffic-demo/traffic_sample_02.roi-density.json'
import type { RoiDensityResult } from '../domain/roiDensityResult'

export type DemoVehicleClass = 'bicycle' | 'car' | 'motorcycle' | 'bus' | 'truck'

export interface DemoDetection {
  class: string
  coco_class_id: number
  traffic_category: string
  confidence: number
  bbox_xyxy: number[]
  track_id?: number
}

export interface DemoFrame {
  frame_index: number
  offset_seconds: number
  vehicle_counts_this_frame: Record<DemoVehicleClass, number>
  detections: DemoDetection[]
  line_crossings_this_frame?: DemoCrossingEvent[]
}

export interface DemoCrossingEvent {
  track_id: number
  class: string
  traffic_category: string | null
  direction: string
  frame_index: number
  timestamp_seconds: number | null
  crossing_xy: number[]
}

export interface DemoAnalysis {
  schema_version: string
  record_kind: string
  is_live_cctv: boolean
  source_video_identifier: string
  source_video_sha256: string
  source_reference: string
  input_duration_seconds: number
  source_fps: number
  video_dimensions: { width: number; height: number }
  source_frame_count: number
  sample_frame_interval: number
  processed_frame_count: number
  requested_sampled_fps: number
  sampled_fps: number
  model: { name: string; version: string; sha256: string; license: string }
  tracking: {
    enabled: boolean
    reason?: string
    algorithm?: string
    quality?: string
    max_distance_pixels?: number
    max_missed_frames?: number
    roi_normalized?: number[] | null
    counting_line_normalized?: number[] | null
  }
  processing_config: {
    minimum_detection_confidence: number
    roi_normalized: number[] | null
    counting_line_normalized: number[] | null
    allowed_direction: string
    tracking_algorithm: string
    max_track_distance_pixels: number
    max_missed_frames: number
  }
  detection_instances_by_class: Record<DemoVehicleClass, number>
  detection_instances_by_traffic_category: Record<'LV' | 'HV' | 'MC' | 'bicycle', number>
  tracked_objects_count: number
  tracked_objects: Array<{
    track_id: number; class: string; traffic_category: string | null; observations: number
    crossed_counting_line: boolean; mean_detection_confidence: number; gap_reacquisitions: number
    max_intervening_missed_samples: number; max_prediction_error_pixels: number; last_prediction_error_pixels: number
  }>
  tracking_quality: {
    status: string; single_detection_track_count: number; mean_sampled_observations_per_track: number
    tracks_with_gap_reacquisition: number; max_intervening_missed_samples: number
    max_prediction_error_pixels: number; untracked_detection_instances_outside_roi: number
    track_count_by_class: Record<DemoVehicleClass, number>; note: string
  }
  crossing_event_count: number
  crossing_events: DemoCrossingEvent[]
  ground_truth_evaluation: null | Record<string, unknown>
  ground_truth_status: string
  vehicle_count_semantics: string
  peak_vehicles_in_sampled_frame: Record<DemoVehicleClass, number>
  condition: null
  condition_note: string
  frames: DemoFrame[]
  created_at: string
}

export interface TrafficDemoVideo {
  id: string
  title: string
  creator: string
  sourceUrl: string
  previewVideoUrl: string
  videoUrl: string
  analysis: DemoAnalysis
  roiDensity: RoiDensityResult
}

export const trafficDemoVideos: readonly TrafficDemoVideo[] = [
  {
    id: 'traffic-sample-01',
    title: 'City Intersection with Traffic and Signals',
    creator: 'SHOX ART',
    sourceUrl: 'https://www.pexels.com/video/city-intersection-with-traffic-and-signals-36330668/',
    previewVideoUrl: '/traffic-demo/traffic_sample_01.mp4',
    videoUrl: '/traffic-demo/traffic_sample_01_annotated.mp4',
    analysis: sample01,
    roiDensity: sample01RoiDensity as RoiDensityResult,
  },
  {
    id: 'traffic-sample-02',
    title: 'Bustling Night Traffic at Ben Thanh Market',
    creator: 'Media Dung',
    sourceUrl: 'https://www.pexels.com/video/bustling-night-traffic-at-ben-thanh-market-29185480/',
    previewVideoUrl: '/traffic-demo/traffic_sample_02.mp4',
    videoUrl: '/traffic-demo/traffic_sample_02_annotated.mp4',
    analysis: sample02,
    roiDensity: sample02RoiDensity as RoiDensityResult,
  },
]

export function demoDetectionTotal(analysis: DemoAnalysis): number {
  return Object.values(analysis.detection_instances_by_class).reduce((sum, count) => sum + count, 0)
}

export function demoFrameAt(analysis: DemoAnalysis, seconds: number): DemoFrame | null {
  let current: DemoFrame | null = null
  for (const frame of analysis.frames) {
    if (frame.offset_seconds > seconds) break
    current = frame
  }
  return current
}
