import type { TrafficCondition } from './traffic'

export interface TrafficCounts {
  lightVehicle: number
  heavyVehicle: number
  motorcycle: number
  bicycle: number
}

export interface TrafficCapacityConfig {
  baseCapacitySmpPerHour: number
  laneWidthFactor: number
  directionalFactor: number
  sideFrictionFactor: number
  citySizeFactor: number
  pce: { lightVehicle: number; heavyVehicle: number; motorcycle: number; bicycle: number | null }
}

export interface TrafficFlowMeasurement {
  provenance: 'operational_cctv' | 'demo_video'
  counts: TrafficCounts
  durationSeconds: number
  countingMethod: 'tracked_line_crossings' | 'frame_detections' | 'manual'
  trackingValidated: boolean
  validationReference?: string
}

export type TrafficCalculation =
  | { available: false; reason: string }
  | {
      available: true
      methodVersion: 'webgista-vc-v1'
      countingMethod: 'tracked_line_crossings'
      validationReference: string
      durationSeconds: number
      weightedVehicleUnits: number
      volumeSmpPerHour: number
      capacitySmpPerHour: number
      volumeCapacityRatio: number
      condition: TrafficCondition
      counts: TrafficCounts
      config: TrafficCapacityConfig
    }

const MINIMUM_OBSERVATION_SECONDS = 10

export function classifyVolumeCapacityRatio(value: number): TrafficCondition | null {
  if (!Number.isFinite(value) || value < 0) return null
  if (value < 0.6) return 'great'
  if (value < 0.7) return 'good'
  if (value < 0.8) return 'average'
  if (value < 0.9) return 'poor'
  if (value <= 1) return 'bad'
  return 'terrible'
}

export function calculateTrafficCondition(
  measurement: TrafficFlowMeasurement,
  config: TrafficCapacityConfig,
): TrafficCalculation {
  const { counts, durationSeconds } = measurement
  if (measurement.provenance !== 'operational_cctv') return { available: false, reason: 'Demo-video analysis is not an operational CCTV measurement.' }
  if (measurement.countingMethod !== 'tracked_line_crossings') return { available: false, reason: 'Only line-crossing counts measure flow; frame detections do not.' }
  if (!measurement.trackingValidated || !measurement.validationReference?.trim()) return { available: false, reason: 'Vehicle tracking has not been validated against a referenced count.' }
  if (!Number.isFinite(durationSeconds) || durationSeconds < MINIMUM_OBSERVATION_SECONDS) return { available: false, reason: 'A valid flow observation must cover at least 10 seconds.' }
  if (Object.values(counts).some((count) => !Number.isSafeInteger(count) || count < 0)) return { available: false, reason: 'Vehicle counts must be non-negative whole numbers.' }
  if (counts.bicycle > 0 && config.pce.bicycle === null) return { available: false, reason: 'No bicycle passenger-car equivalence is configured for this road.' }

  const factors = [config.baseCapacitySmpPerHour, config.laneWidthFactor, config.directionalFactor, config.sideFrictionFactor, config.citySizeFactor]
  const coefficients = [config.pce.lightVehicle, config.pce.heavyVehicle, config.pce.motorcycle, ...(config.pce.bicycle === null ? [] : [config.pce.bicycle])]
  if (factors.some((value) => !Number.isFinite(value) || value <= 0) || coefficients.some((value) => !Number.isFinite(value) || value < 0)) {
    return { available: false, reason: 'Road capacity and vehicle-equivalence configuration must contain valid non-negative values.' }
  }

  const weightedVehicleUnits = counts.lightVehicle * config.pce.lightVehicle
    + counts.heavyVehicle * config.pce.heavyVehicle
    + counts.motorcycle * config.pce.motorcycle
    + counts.bicycle * (config.pce.bicycle ?? 0)
  const volumeSmpPerHour = weightedVehicleUnits * 3600 / durationSeconds
  const capacitySmpPerHour = factors.reduce((capacity, factor) => capacity * factor, 1)
  const volumeCapacityRatio = volumeSmpPerHour / capacitySmpPerHour
  const condition = classifyVolumeCapacityRatio(volumeCapacityRatio)
  if (!condition || !Number.isFinite(volumeSmpPerHour) || !Number.isFinite(capacitySmpPerHour)) {
    return { available: false, reason: 'The calculated flow or capacity is outside the supported numeric range.' }
  }

  return {
    available: true,
    methodVersion: 'webgista-vc-v1',
    countingMethod: 'tracked_line_crossings',
    validationReference: measurement.validationReference!.trim(),
    durationSeconds,
    weightedVehicleUnits,
    volumeSmpPerHour,
    capacitySmpPerHour,
    volumeCapacityRatio,
    condition,
    counts,
    config,
  }
}
