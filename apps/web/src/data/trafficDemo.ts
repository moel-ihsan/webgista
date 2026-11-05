import sample01 from './traffic-demo/traffic_sample_01.analysis.json'
import sample02 from './traffic-demo/traffic_sample_02.analysis.json'

export type DemoVehicleClass = 'bicycle' | 'car' | 'motorcycle' | 'bus' | 'truck'

export interface DemoDetection {
  class: string
  confidence: number
  bbox_xyxy: number[]
  track_id?: number
}

export interface DemoFrame {
  offset_seconds: number
  vehicle_counts_this_frame: Record<DemoVehicleClass, number>
  detections: DemoDetection[]
  line_crossings_this_frame?: Array<{ track_id: number; class: string }>
}

export interface DemoAnalysis {
  schema_version: string
  record_kind: string
  is_live_cctv: boolean
  input_duration_seconds: number
  sampled_fps: number
  model: { name: string; version: string; license: string }
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
  vehicle_count_semantics: string
  peak_vehicles_in_sampled_frame: Record<DemoVehicleClass, number>
  line_crossing_counts_by_class?: Record<DemoVehicleClass, number> | null
  line_crossing_total?: number | null
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
  },
  {
    id: 'traffic-sample-02',
    title: 'Bustling Night Traffic at Ben Thanh Market',
    creator: 'Media Dung',
    sourceUrl: 'https://www.pexels.com/video/bustling-night-traffic-at-ben-thanh-market-29185480/',
    previewVideoUrl: '/traffic-demo/traffic_sample_02.mp4',
    videoUrl: '/traffic-demo/traffic_sample_02_annotated.mp4',
    analysis: sample02,
  },
]

export function demoDetectionTotal(analysis: DemoAnalysis): number {
  return analysis.frames.reduce((sum, frame) => sum + frame.detections.length, 0)
}

export function demoFrameAt(analysis: DemoAnalysis, seconds: number): DemoFrame | null {
  let current: DemoFrame | null = null
  for (const frame of analysis.frames) {
    if (frame.offset_seconds > seconds) break
    current = frame
  }
  return current
}
