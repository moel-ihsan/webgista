export const REVIEW_SCHEMA = 'webgista.traffic-ground-truth.v1'
export const REVIEW_STATUSES = ['unreviewed', 'confirmed', 'corrected', 'rejected', 'uncertain']
export const VEHICLE_CLASSES = ['car', 'motorcycle', 'bus', 'truck', 'bicycle']
export const DIRECTIONS = ['negative_to_positive', 'positive_to_negative']
export const DIAGNOSTICS = ['unclassified', 'not_detected', 'detection_not_tracked', 'fragmented_track', 'merged_tracks', 'wrong_direction', 'outside_counting_segment', 'duplicate_crossing', 'other']

export function frameForTimestamp(seconds, sourceFps) {
  if (!Number.isFinite(seconds) || seconds < 0 || !Number.isFinite(sourceFps) || sourceFps <= 0) throw new Error('Timestamp and source FPS must be valid.')
  return Math.round(seconds * sourceFps)
}

export function createReviewPackage(video, analysis) {
  return {
    schema_version: REVIEW_SCHEMA,
    video: {
      id: analysis.source_video_identifier,
      title: video.title,
      source_sha256: analysis.source_video_sha256,
      duration_seconds: analysis.input_duration_seconds,
      source_fps: analysis.source_fps,
      source_frame_count: analysis.source_frame_count,
      dimensions: analysis.video_dimensions,
      roi_normalized: analysis.processing_config.roi_normalized,
      counting_line_normalized: analysis.processing_config.counting_line_normalized,
    },
    reviewer: '',
    review_progress: { reviewed_seconds: [], attested: false, full_clip_reviewed: false },
    events: [],
  }
}

export function validateReviewPackage(value, expected) {
  if (!value || value.schema_version !== REVIEW_SCHEMA || !Array.isArray(value.events)) throw new Error('Unsupported ground-truth review file.')
  if (value.video?.id !== expected.id || value.video?.source_sha256 !== expected.source_sha256) throw new Error('Review file video ID or SHA-256 does not match this source video.')
  if (!Array.isArray(value.review_progress?.reviewed_seconds)
    || value.review_progress.reviewed_seconds.some((second) => !Number.isSafeInteger(second) || second < 0 || second >= Math.ceil(expected.duration_seconds))) throw new Error('Review coverage contains an invalid second.')
  const ids = new Set()
  for (const event of value.events) {
    if (typeof event.event_id !== 'string' || !event.event_id.trim() || ids.has(event.event_id)) throw new Error('Event IDs must be present and unique.')
    ids.add(event.event_id)
    if (!VEHICLE_CLASSES.includes(event.vehicle_class) || !DIRECTIONS.includes(event.direction) || !REVIEW_STATUSES.includes(event.review_status) || !DIAGNOSTICS.includes(event.diagnostic_category ?? 'unclassified')) throw new Error(`Event ${event.event_id} has an unsupported class, direction, status, or diagnostic.`)
    if (!Number.isFinite(event.timestamp_seconds) || event.timestamp_seconds < 0 || event.timestamp_seconds > expected.duration_seconds) throw new Error(`Event ${event.event_id} has an invalid timestamp.`)
    if (!Number.isSafeInteger(event.frame_index) || event.frame_index < 0 || event.frame_index >= expected.source_frame_count) throw new Error(`Event ${event.event_id} has an invalid frame index.`)
    if (typeof event.annotation_provenance !== 'string' || !event.annotation_provenance.trim() || typeof event.reviewer !== 'string' || typeof event.reviewer_note !== 'string') throw new Error(`Event ${event.event_id} is missing reviewer provenance.`)
    if (['confirmed', 'corrected'].includes(event.review_status) && !event.reviewer.trim()) throw new Error(`Event ${event.event_id} needs a reviewer before confirmation.`)
    if (Math.abs(event.frame_index - frameForTimestamp(event.timestamp_seconds, expected.source_fps)) > 1) throw new Error(`Event ${event.event_id} frame does not match its timestamp.`)
  }
  return value
}

export function nextEventId(events) {
  const largest = events.reduce((max, event) => {
    const match = /^GT-(\d+)$/.exec(event.event_id)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)
  return `GT-${String(largest + 1).padStart(3, '0')}`
}

export function possibleDuplicate(events, event, toleranceSeconds = 0.5) {
  return events.find((row) => row.review_status !== 'rejected'
    && row.vehicle_class === event.vehicle_class
    && row.direction === event.direction
    && Math.abs(row.timestamp_seconds - event.timestamp_seconds) <= toleranceSeconds) ?? null
}

export function annotationsToCsv(review) {
  const fields = ['video_id', 'video_sha256', 'event_id', 'timestamp_seconds', 'frame_index', 'vehicle_class', 'direction', 'review_status', 'diagnostic_category', 'reviewer', 'reviewer_note', 'annotation_provenance', 'full_clip_reviewed']
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
  const rows = review.events.map((event) => [
    review.video.id, review.video.source_sha256, event.event_id, event.timestamp_seconds, event.frame_index,
    event.vehicle_class, event.direction, event.review_status, event.diagnostic_category, event.reviewer, event.reviewer_note,
    event.annotation_provenance, review.review_progress.full_clip_reviewed,
  ])
  return `${fields.join(',')}\n${rows.map((row) => row.map(escape).join(',')).join('\n')}${rows.length ? '\n' : ''}`
}
