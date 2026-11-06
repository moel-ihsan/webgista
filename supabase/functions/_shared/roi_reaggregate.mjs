const classes = ['car', 'motorcycle', 'bus', 'truck', 'bicycle']
const included = new Set(['car', 'motorcycle', 'bus', 'truck'])

function inside(point, polygon) {
  let result = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i], [xj, yj] = polygon[j]
    if ((yi > point[1]) !== (yj > point[1]) && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) result = !result
  }
  return result
}

function polygonOf(config) {
  const g = config.roi_geometry
  if (config.roi_type === 'rectangle' && Array.isArray(g) && g.length === 4) {
    const [x, y, w, h] = g
    if (![x, y, w, h].every(Number.isFinite) || x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > 1 || y + h > 1) throw Error('Invalid ROI rectangle')
    return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]
  }
  if (config.roi_type === 'polygon' && Array.isArray(g) && g.length >= 3 && g.length <= 64 && g.every(p => Array.isArray(p) && p.length === 2 && p.every(v => Number.isFinite(v) && v >= 0 && v <= 1))) return g
  throw Error('Invalid saved ROI geometry')
}

export function reaggregate(document, config, configurationVersion) {
  if (document?.schema_version !== 'webgista.traffic-analysis.v2' || document.source_video_identifier !== config.source_video_identifier) throw Error('Detection artifact does not match the saved source video')
  const { width, height } = document.video_dimensions ?? {}
  if (width !== config.video_dimensions?.width || height !== config.video_dimensions?.height || !Array.isArray(document.frames) || document.frames.length > 200) throw Error('Detection artifact dimensions or frame count are invalid')
  if (!(document.input_duration_seconds > 0 && document.input_duration_seconds <= 120)) throw Error('Video duration is outside processing limits')
  const polygon = polygonOf(config)
  const confidenceLimit = 0.35
  const samples = document.frames.map(frame => {
    if (!Number.isFinite(frame.offset_seconds) || !Array.isArray(frame.detections) || frame.detections.length > 100) throw Error('Invalid detection frame')
    const counts = Object.fromEntries(classes.map(name => [name, 0]))
    const valid = frame.detections.filter(d => included.has(d.class) && Number.isFinite(d.confidence) && d.confidence >= confidenceLimit && Array.isArray(d.bbox_xyxy) && d.bbox_xyxy.length === 4 && d.bbox_xyxy.every(Number.isFinite))
    const insideDetections = []
    for (const d of valid) {
      const [x1, y1, x2, y2] = d.bbox_xyxy
      if (x1 < 0 || y1 < 0 || x1 >= x2 || y1 >= y2 || x2 > width || y2 > height) throw Error('Detection box outside source dimensions')
      if (inside([(x1 + x2) / (2 * width), y2 / height], polygon)) { counts[d.class] += 1; insideDetections.push(d) }
    }
    const gridW = 160, gridH = 90, roi = new Uint8Array(gridW * gridH), vehicles = new Uint8Array(gridW * gridH)
    for (let y = 0; y < gridH; y++) for (let x = 0; x < gridW; x++) if (inside([(x + 0.5) / gridW, (y + 0.5) / gridH], polygon)) roi[y * gridW + x] = 1
    for (const d of insideDetections) {
      const [x1, y1, x2, y2] = d.bbox_xyxy
      const left = Math.max(0, Math.ceil(x1 / width * gridW - 0.5)), right = Math.min(gridW, Math.ceil(x2 / width * gridW - 0.5))
      const top = Math.max(0, Math.ceil(y1 / height * gridH - 0.5)), bottom = Math.min(gridH, Math.ceil(y2 / height * gridH - 0.5))
      for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
        const px = (x + 0.5) / gridW * width, py = (y + 0.5) / gridH * height
        if (px >= x1 && px < x2 && py >= y1 && py < y2) vehicles[y * gridW + x] = 1
      }
    }
    let covered = 0, roiPixels = 0
    for (let i = 0; i < roi.length; i++) if (roi[i]) { roiPixels++; covered += vehicles[i] }
    return { t: frame.offset_seconds, counts, coverage: roiPixels ? covered / roiPixels : null }
  }).sort((a, b) => a.t - b.t)
  const period = 0.2, windows = []
  for (let start = 0; start < document.input_duration_seconds; start += 10) {
    const end = Math.min(start + 10, document.input_duration_seconds), complete = end - start >= 10 - 1e-6
    const selected = samples.filter(s => s.t >= start && s.t < end)
    const sums = Object.fromEntries(classes.map(name => [name, 0])), peaks = Object.fromEntries(classes.map(name => [name, 0]))
    let coveredSeconds = 0, coverageSum = 0, busy = 0, peakTotal = 0
    for (let i = 0; i < selected.length; i++) {
      const s = selected[i], next = selected[i + 1]?.t ?? end, weight = Math.min(period, Math.max(0, next - s.t), end - s.t)
      coveredSeconds += weight
      for (const c of classes) { sums[c] += s.counts[c] * weight; peaks[c] = Math.max(peaks[c], s.counts[c]) }
      const total = Object.values(s.counts).reduce((a, b) => a + b, 0)
      peakTotal = Math.max(peakTotal, total)
      if (total > 0) busy += weight
      coverageSum += (s.coverage ?? 0) * weight
    }
    const valid = complete && selected.length > 0 && coveredSeconds / (end - start) >= 0.8
    const avg = Object.fromEntries(classes.map(c => [c, coveredSeconds ? Number((sums[c] / coveredSeconds).toFixed(4)) : null]))
    windows.push({
      window_started_at_seconds: Number(start.toFixed(3)), window_ended_at_seconds: Number(end.toFixed(3)),
      window_duration_seconds: Number((end - start).toFixed(3)), status: complete ? 'complete' : 'partial',
      classification_status: valid ? 'no_data' : !complete ? 'insufficient_duration' : 'insufficient_coverage',
      condition: null, condition_reason: valid ? 'No validated vehicle-flow measurement and camera-specific road capacity are available for MKJI V/C.' : !complete ? 'The interval is shorter than the required 10 seconds.' : 'Valid sampled-frame coverage is below the required minimum.',
      average_vehicles_present: coveredSeconds ? Number(Object.values(avg).reduce((a, b) => a + b, 0).toFixed(4)) : null,
      peak_vehicles_present: selected.length ? peakTotal : null,
      class_statistics: Object.fromEntries(classes.map(c => [c, { average: avg[c], peak: peaks[c] }])),
      traffic_category_statistics: {
        LV: { average: avg.car, peak: peaks.car },
        HV: { average: coveredSeconds ? Number(((sums.bus + sums.truck) / coveredSeconds).toFixed(4)) : null, peak: peaks.bus + peaks.truck },
        MC: { average: avg.motorcycle, peak: peaks.motorcycle },
        bicycle: { average: avg.bicycle, peak: peaks.bicycle },
      },
      busy_duration_seconds: Number(busy.toFixed(3)), busy_duration_percentage: coveredSeconds ? Number((100 * busy / coveredSeconds).toFixed(2)) : null,
      roi_image_coverage_average: coveredSeconds ? Number((coverageSum / coveredSeconds).toFixed(5)) : null,
      data_quality: { expected_samples: Math.round((end - start) * 5), valid_samples: selected.length, missing_samples: Math.max(0, Math.round((end - start) * 5) - selected.length), effective_observation_seconds: Number(coveredSeconds.toFixed(3)), valid_observation_coverage: Number((coveredSeconds / (end - start)).toFixed(5)), processing_fps: 5, sample_period_seconds: 0.2 },
    })
  }
  return { configurationVersion, source_video_identifier: document.source_video_identifier, source_video_sha256: document.source_video_sha256, analysis_method_version: 'roi_density_v1', provenance: 'experimental_demo_video', windows }
}
