export type RoiPoint = [number, number]
export type RoiType = 'rectangle' | 'polygon'
export type RoiDensityClass = 'great' | 'good' | 'average' | 'poor' | 'bad' | 'terrible'
export type RoiCalibrationStatus = 'uncalibrated' | 'experimental' | 'calibrated'
export const ROI_DENSITY_CLASSES: readonly RoiDensityClass[] = ['great', 'good', 'average', 'poor', 'bad', 'terrible']
export const ROI_VEHICLE_CLASSES = ['car', 'bus', 'truck', 'motorcycle', 'bicycle'] as const

export interface RoiDensityConfig {
  schema_version: 'webgista.roi-density-config.v1'
  roi_type: RoiType
  roi_geometry: number[] | RoiPoint[]
  video_dimensions: { width: number; height: number }
  observation_window_seconds: number
  refresh_seconds: number
  sampled_fps: number
  minimum_detection_confidence: number
  included_classes: string[]
  busy_threshold_vehicles: number
  minimum_valid_coverage: number
  density_thresholds: number[] | null
  calibration_status: RoiCalibrationStatus
  calibration_note: string
}

export function rectangleToPolygon(rectangle: readonly number[]): RoiPoint[] {
  if (rectangle.length !== 4) throw new Error('Rectangle must contain x, y, width, and height.')
  const x = rectangle[0]!
  const y = rectangle[1]!
  const width = rectangle[2]!
  const height = rectangle[3]!
  if (![x, y, width, height].every(Number.isFinite) || x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1 || y + height > 1) {
    throw new Error('Rectangle must fit inside normalized video coordinates.')
  }
  return [[x, y], [x + width, y], [x + width, y + height], [x, y + height]]
}

function orientation(a: RoiPoint, b: RoiPoint, c: RoiPoint): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
}

function segmentsIntersect(a: RoiPoint, b: RoiPoint, c: RoiPoint, d: RoiPoint): boolean {
  const abC = orientation(a, b, c)
  const abD = orientation(a, b, d)
  const cdA = orientation(c, d, a)
  const cdB = orientation(c, d, b)
  const onSegment = (start: RoiPoint, point: RoiPoint, end: RoiPoint) =>
    point[0] >= Math.min(start[0], end[0]) && point[0] <= Math.max(start[0], end[0])
      && point[1] >= Math.min(start[1], end[1]) && point[1] <= Math.max(start[1], end[1])
  return (abC * abD < 0 && cdA * cdB < 0)
    || (abC === 0 && onSegment(a, c, b)) || (abD === 0 && onSegment(a, d, b))
    || (cdA === 0 && onSegment(c, a, d)) || (cdB === 0 && onSegment(c, b, d))
}

export function validateRoiPolygon(points: readonly RoiPoint[]): RoiPoint[] {
  if (points.length < 3 || points.length > 64) throw new Error('ROI polygon requires 3 to 64 vertices.')
  if (points.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1)) {
    throw new Error('ROI vertices must be within normalized video coordinates.')
  }
  if (points.some((point, index) => point[0] === points[(index + 1) % points.length]![0] && point[1] === points[(index + 1) % points.length]![1])) {
    throw new Error('ROI polygon cannot contain zero-length edges.')
  }
  const area = Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length]!
    return sum + point[0] * next[1] - next[0] * point[1]
  }, 0) / 2)
  if (new Set(points.map((point) => `${point[0]},${point[1]}`)).size < 3 || area < 1e-8) {
    throw new Error('ROI polygon must have non-zero area and at least three unique vertices.')
  }
  for (let first = 0; first < points.length; first += 1) {
    const a = points[first]!
    const b = points[(first + 1) % points.length]!
    for (let second = first + 1; second < points.length; second += 1) {
      if (second === first || second === (first + 1) % points.length || (second + 1) % points.length === first) continue
      if (segmentsIntersect(a, b, points[second]!, points[(second + 1) % points.length]!)) {
        throw new Error('ROI polygon edges cannot cross or overlap.')
      }
    }
  }
  return points.map(([x, y]) => [x, y])
}

export function validateRoiDensityConfig(config: RoiDensityConfig): string | null {
  try {
    if (config.roi_type === 'rectangle') rectangleToPolygon(config.roi_geometry as number[])
    else validateRoiPolygon(config.roi_geometry as RoiPoint[])
    if (!Number.isInteger(config.video_dimensions.width) || !Number.isInteger(config.video_dimensions.height)
      || config.video_dimensions.width <= 0 || config.video_dimensions.height <= 0) throw new Error('Video dimensions are invalid.')
    if (!Number.isInteger(config.observation_window_seconds) || config.observation_window_seconds < 1 || config.observation_window_seconds > 300
      || !Number.isInteger(config.refresh_seconds) || config.refresh_seconds < 1 || config.refresh_seconds > 300
      || !Number.isFinite(config.sampled_fps) || config.sampled_fps <= 0 || config.sampled_fps > 10) throw new Error('Window or sampling settings are invalid.')
    if (config.refresh_seconds > config.observation_window_seconds) throw new Error('Window refresh cannot exceed its observation duration.')
    if (!Number.isFinite(config.minimum_detection_confidence) || config.minimum_detection_confidence < 0 || config.minimum_detection_confidence > 1) throw new Error('Confidence must be between 0 and 1.')
    if (!config.included_classes.length || new Set(config.included_classes).size !== config.included_classes.length
      || config.included_classes.some((item) => !(ROI_VEHICLE_CLASSES as readonly string[]).includes(item))) throw new Error('Select supported vehicle classes.')
    if (!Number.isInteger(config.busy_threshold_vehicles) || config.busy_threshold_vehicles < 0) throw new Error('Busy threshold must be a non-negative whole vehicle count.')
    if (!Number.isFinite(config.minimum_valid_coverage) || config.minimum_valid_coverage < 0.5 || config.minimum_valid_coverage > 1) throw new Error('Valid sample coverage must be between 50% and 100%.')
    if (!['uncalibrated', 'experimental', 'calibrated'].includes(config.calibration_status)) throw new Error('Calibration status is invalid.')
    const thresholds = config.density_thresholds
    if (thresholds && (thresholds.length !== 5 || thresholds.some((value, index) => !Number.isFinite(value) || value < 0 || (index > 0 && value <= thresholds[index - 1]!)))) {
      throw new Error('Density thresholds must be five ascending non-negative values.')
    }
    if (config.calibration_status === 'calibrated' && (!thresholds || config.calibration_note.trim().length < 12)) throw new Error('A calibrated estimate requires thresholds and a calibration note.')
    if (config.calibration_status === 'experimental' && !thresholds) throw new Error('Experimental thresholds are required for an estimate.')
    return null
  } catch (error) {
    return error instanceof Error ? error.message : 'ROI configuration is invalid.'
  }
}
