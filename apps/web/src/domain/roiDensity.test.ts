import { describe, expect, it } from 'vitest'

import { rectangleToPolygon, validateRoiDensityConfig, validateRoiPolygon, type RoiDensityConfig } from './roiDensity'

function config(overrides: Partial<RoiDensityConfig> = {}): RoiDensityConfig {
  return {
    schema_version: 'webgista.roi-density-config.v1', roi_type: 'rectangle', roi_geometry: [0.2, 0.2, 0.6, 0.5],
    video_dimensions: { width: 1280, height: 720 }, observation_window_seconds: 10, refresh_seconds: 10,
    sampled_fps: 5, minimum_detection_confidence: 0.35, included_classes: ['car', 'bus', 'truck', 'motorcycle', 'bicycle'],
    busy_threshold_vehicles: 4, minimum_valid_coverage: 0.8, density_thresholds: null,
    calibration_status: 'uncalibrated', calibration_note: '', ...overrides,
  }
}

describe('ROI density configuration', () => {
  it('converts a normalized rectangle into source-relative corners', () => {
    const points = rectangleToPolygon([0.2, 0.3, 0.4, 0.5])
    expect(points[0]).toEqual([0.2, 0.3])
    expect(points[1]?.[0]).toBeCloseTo(0.6)
    expect(points[2]?.[0]).toBeCloseTo(0.6)
    expect(points[2]?.[1]).toBeCloseTo(0.8)
    expect(points[3]).toEqual([0.2, 0.8])
  })

  it('rejects malformed, out-of-bounds, and self-intersecting areas', () => {
    expect(() => rectangleToPolygon([0.8, 0.8, 0.4, 0.4])).toThrow()
    expect(() => validateRoiPolygon([[0, 0], [1, 1], [0, 1], [1, 0]])).toThrow(/area|cross/)
    expect(() => validateRoiPolygon([[0, 0], [1, 0], [1, 0], [0, 1]])).toThrow(/zero-length/)
    expect(validateRoiDensityConfig(config({ density_thresholds: [1, 2, 2, 4, 5], calibration_status: 'experimental' }))).toMatch(/ascending/)
  })

  it('requires a documented note before calling thresholds calibrated', () => {
    expect(validateRoiDensityConfig(config({ density_thresholds: [1, 2, 3, 4, 5], calibration_status: 'calibrated' }))).toMatch(/calibration note/)
    expect(validateRoiDensityConfig(config({ density_thresholds: [1, 2, 3, 4, 5], calibration_status: 'calibrated', calibration_note: 'Validated with reviewed sample frames.' }))).toBeNull()
  })

  it('keeps the ten-second monitoring defaults and rejects invalid refresh values', () => {
    expect(validateRoiDensityConfig(config())).toBeNull()
    expect(validateRoiDensityConfig(config({ observation_window_seconds: 0 }))).toMatch(/Window or sampling/)
    expect(validateRoiDensityConfig(config({ refresh_seconds: 10.5 }))).toMatch(/Window or sampling/)
    expect(validateRoiDensityConfig(config({ observation_window_seconds: 10, refresh_seconds: 11 }))).toMatch(/cannot exceed/)
  })
})
