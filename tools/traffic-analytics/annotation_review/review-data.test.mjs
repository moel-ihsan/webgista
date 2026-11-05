import test from 'node:test'
import assert from 'node:assert/strict'
import { annotationsToCsv, createReviewPackage, frameForTimestamp, nextEventId, possibleDuplicate, validateReviewPackage } from './review-data.mjs'

const video = { id: 'sample-01', title: 'Sample 01' }
const analysis = {
  source_video_identifier: 'sample-01', source_video_sha256: 'abc123', input_duration_seconds: 23,
  source_fps: 24, source_frame_count: 552, video_dimensions: { width: 1280, height: 720 },
  processing_config: { roi_normalized: [0, 0, 1, 1], counting_line_normalized: [0.5, 0, 0.5, 1] },
}
const confirmed = (overrides = {}) => ({
  event_id: 'GT-001', timestamp_seconds: 2, frame_index: 48, vehicle_class: 'car',
  direction: 'positive_to_negative', review_status: 'confirmed', reviewer: 'reviewer-1',
  reviewer_note: 'clear crossing', annotation_provenance: 'human_video_review', ...overrides,
})

test('frame mapping uses original-source FPS, not sampled inference FPS', () => {
  assert.equal(frameForTimestamp(1.25, 24), 30)
  assert.throws(() => frameForTimestamp(-1, 24), /valid/)
})

test('review import accepts matching source hash and rejects duplicates or wrong source', () => {
  const review = createReviewPackage(video, analysis)
  review.events.push(confirmed())
  assert.equal(validateReviewPackage(review, review.video), review)
  assert.throws(() => validateReviewPackage({ ...review, events: [confirmed(), confirmed()] }, review.video), /unique/)
  assert.throws(() => validateReviewPackage(review, { ...review.video, source_sha256: 'different' }), /SHA-256/)
})

test('confirmed labels require a reviewer and valid review status', () => {
  const review = createReviewPackage(video, analysis)
  review.events.push(confirmed({ reviewer: '' }))
  assert.throws(() => validateReviewPackage(review, review.video), /reviewer/)
  review.events[0].reviewer = 'reviewer-1'
  review.events[0].review_status = 'invented'
  assert.throws(() => validateReviewPackage(review, review.video), /unsupported/)
})

test('review import rejects fabricated coverage seconds and inconsistent timestamp/frame pairs', () => {
  const review = createReviewPackage(video, analysis)
  review.events.push(confirmed({ frame_index: 80 }))
  assert.throws(() => validateReviewPackage(review, review.video), /frame does not match/)
  review.events = []
  review.review_progress.reviewed_seconds = [23]
  assert.throws(() => validateReviewPackage(review, review.video), /coverage contains/)
})

test('annotation ID generation and duplicate warning are deterministic', () => {
  const events = [confirmed(), confirmed({ event_id: 'manual-row' }), confirmed({ event_id: 'GT-009' })]
  assert.equal(nextEventId(events), 'GT-010')
  assert.equal(possibleDuplicate(events, confirmed({ event_id: 'GT-010', timestamp_seconds: 2.4 }))?.event_id, 'GT-001')
  assert.equal(possibleDuplicate(events, confirmed({ vehicle_class: 'bus' })), null)
})

test('CSV export escapes notes and retains review provenance/status', () => {
  const review = createReviewPackage(video, analysis)
  review.review_progress.full_clip_reviewed = true
  review.events.push(confirmed({ reviewer_note: 'signal, "clear"' }))
  const csv = annotationsToCsv(review)
  assert.match(csv, /video_id,video_sha256,event_id/)
  assert.match(csv, /"signal, ""clear"""/)
  assert.match(csv, /"confirmed"/)
})

test('reviewer diagnostics remain separate optional metadata', () => {
  const review = createReviewPackage(video, analysis)
  review.events.push(confirmed({ diagnostic_category: 'fragmented_track' }))
  assert.equal(validateReviewPackage(review, review.video).events[0].diagnostic_category, 'fragmented_track')
  assert.match(annotationsToCsv(review), /diagnostic_category/)
  review.events[0].diagnostic_category = 'invented'
  assert.throws(() => validateReviewPackage(review, review.video), /diagnostic/)
})
