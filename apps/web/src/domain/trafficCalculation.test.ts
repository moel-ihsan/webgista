import { describe, expect, it } from 'vitest'
import { calculateTrafficCondition, classifyVolumeCapacityRatio, type TrafficCapacityConfig, type TrafficFlowMeasurement } from './trafficCalculation'

const config: TrafficCapacityConfig = {
  baseCapacitySmpPerHour: 1650,
  laneWidthFactor: 1,
  directionalFactor: 1,
  sideFrictionFactor: 1,
  citySizeFactor: 0.9,
  pce: { lightVehicle: 1, heavyVehicle: 1.3, motorcycle: 0.4, bicycle: null },
}

const measurement = (overrides: Partial<TrafficFlowMeasurement> = {}): TrafficFlowMeasurement => ({
  provenance: 'operational_cctv',
  counts: { lightVehicle: 0, heavyVehicle: 0, motorcycle: 0, bicycle: 0 },
  durationSeconds: 10,
  countingMethod: 'tracked_line_crossings',
  trackingValidated: true,
  validationReference: 'count-sheet-v1',
  ...overrides,
})

describe('traffic volume/capacity method', () => {
  it.each([
    [0, 'great'], [0.599999, 'great'], [0.6, 'good'], [0.7, 'average'],
    [0.8, 'poor'], [0.9, 'bad'], [1, 'bad'], [1.000001, 'terrible'],
  ] as const)('maps V/C %s to %s', (ratio, condition) => {
    expect(classifyVolumeCapacityRatio(ratio)).toBe(condition)
  })

  it('treats a valid zero count as Great and applies flow and capacity units', () => {
    const result = calculateTrafficCondition(measurement(), config)
    expect(result).toMatchObject({ available: true, condition: 'great', weightedVehicleUnits: 0, volumeSmpPerHour: 0, capacitySmpPerHour: 1485 })
  })

  it('calculates flow from validated crossings in one ten-second observation window', () => {
    const result = calculateTrafficCondition(measurement({
      counts: { lightVehicle: 1, heavyVehicle: 0, motorcycle: 0, bicycle: 0 },
    }), config)
    expect(result).toMatchObject({ available: true, volumeSmpPerHour: 360, capacitySmpPerHour: 1485 })
  })

  it('normalizes only validated crossings and preserves count provenance', () => {
    const result = calculateTrafficCondition(measurement({
      durationSeconds: 60,
      counts: { lightVehicle: 10, heavyVehicle: 2, motorcycle: 5, bicycle: 0 },
    }), config)
    expect(result).toMatchObject({ available: true, weightedVehicleUnits: 14.6, volumeSmpPerHour: 876, countingMethod: 'tracked_line_crossings', validationReference: 'count-sheet-v1' })
  })

  it('never accepts demo-video crossings as operational traffic measurements', () => {
    expect(calculateTrafficCondition(measurement({ provenance: 'demo_video' }), config)).toMatchObject({
      available: false,
      reason: expect.stringContaining('Demo-video analysis'),
    })
  })

  it.each([
    [measurement({ countingMethod: 'frame_detections' }), config, 'Only line-crossing counts measure flow'],
    [measurement({ trackingValidated: false }), config, 'not been validated'],
    [measurement({ durationSeconds: 9.9 }), config, 'at least 10 seconds'],
    [measurement({ counts: { lightVehicle: -1, heavyVehicle: 0, motorcycle: 0, bicycle: 0 } }), config, 'non-negative'],
    [measurement({ counts: { lightVehicle: 0, heavyVehicle: 0, motorcycle: 0, bicycle: 1 } }), config, 'bicycle'],
    [measurement(), { ...config, baseCapacitySmpPerHour: 0 }, 'configuration'],
  ])('does not classify unsupported inputs', (input, capacity, reason) => {
    expect(calculateTrafficCondition(input, capacity)).toMatchObject({ available: false, reason: expect.stringContaining(reason) })
  })

  it('rejects non-finite or negative V/C', () => {
    expect(classifyVolumeCapacityRatio(Number.NaN)).toBeNull()
    expect(classifyVolumeCapacityRatio(-0.1)).toBeNull()
  })
})
