export type TrafficCondition =
  | 'great'
  | 'good'
  | 'average'
  | 'poor'
  | 'bad'
  | 'terrible'

export type CountingMethod = 'frame_detections' | 'tracked_line_crossings' | 'manual'

export interface TrafficObservation {
  id: string
  cctvId: string
  windowStartedAt: string
  windowEndedAt: string
  lightVehicleCount: number
  heavyVehicleCount: number
  motorcycleCount: number
  bicycleCount: number
  sampledFrames: number
  countingMethod: CountingMethod
  condition: TrafficCondition | null
  qualityFlags: readonly string[]
}
