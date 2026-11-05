import { annotationsToCsv, createReviewPackage, frameForTimestamp, nextEventId, possibleDuplicate, validateReviewPackage, REVIEW_STATUSES, VEHICLE_CLASSES, DIRECTIONS, DIAGNOSTICS } from './review-data.mjs'

const demos = [
  { id: 'traffic_sample_01', title: 'City Intersection with Traffic and Signals', creator: 'SHOX ART', source: '/apps/web/public/traffic-demo/traffic_sample_01.mp4', analysis: '/apps/web/src/data/traffic-demo/traffic_sample_01.analysis.json' },
  { id: 'traffic_sample_02', title: 'Bustling Night Traffic at Ben Thanh Market', creator: 'Media Dung', source: '/apps/web/public/traffic-demo/traffic_sample_02.mp4', analysis: '/apps/web/src/data/traffic-demo/traffic_sample_02.analysis.json' },
]
const $ = (id) => document.getElementById(id)
const video = $('video')
const canvas = $('overlay')
const context = canvas.getContext('2d')
let selected, analysis, review, previousPlaybackTime = null, focusedWindowEnd = null
let fullCoverage = false

function setStatus(message) { $('status').textContent = message }
function keyFor(videoId, sha) { return `webgista-review:${videoId}:${sha}` }
function save() {
  review.reviewer = $('reviewer').value.trim()
  review.review_progress.reviewed_seconds = [...review.review_progress.reviewed_seconds].sort((a, b) => a - b)
  review.review_progress.full_clip_reviewed = fullCoverage && review.review_progress.attested
  localStorage.setItem(keyFor(review.video.id, review.video.source_sha256), JSON.stringify(review))
}
function updateTime() {
  if (!Number.isFinite(video.currentTime)) return
  $('seek').value = video.currentTime.toFixed(3)
  $('time-display').textContent = `${video.currentTime.toFixed(3)} s · frame ${Math.round(video.currentTime * analysis.source_fps)}`
  drawOverlay()
}
function drawOverlay() {
  if (!analysis || !video.videoWidth) return
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  context.clearRect(0, 0, canvas.width, canvas.height)
  const roi = analysis.processing_config.roi_normalized
  const line = analysis.processing_config.counting_line_normalized
  if (roi) {
    context.strokeStyle = '#00b9ff'; context.lineWidth = Math.max(2, canvas.width / 600)
    context.strokeRect(roi[0] * canvas.width, roi[1] * canvas.height, roi[2] * canvas.width, roi[3] * canvas.height)
  }
  if (line) {
    context.strokeStyle = '#ff8c00'; context.lineWidth = Math.max(3, canvas.width / 400)
    context.beginPath(); context.moveTo(line[0] * canvas.width, line[1] * canvas.height)
    context.lineTo(line[2] * canvas.width, line[3] * canvas.height); context.stroke()
  }
  if ($('model-overlay').checked) {
    const frame = analysis.frames.reduce((closest, item) => Math.abs(item.offset_seconds - video.currentTime) < Math.abs(closest.offset_seconds - video.currentTime) ? item : closest, analysis.frames[0])
    if (Math.abs(frame.offset_seconds - video.currentTime) <= 0.5 / analysis.sampled_fps) {
      context.font = `${Math.max(12, canvas.width / 90)}px system-ui`
      for (const detection of frame.detections) {
        const [x1, y1, x2, y2] = detection.bbox_xyxy
        context.strokeStyle = '#00e676'; context.lineWidth = Math.max(2, canvas.width / 600)
        context.strokeRect(x1, y1, x2 - x1, y2 - y1)
        context.fillStyle = '#00e676'
        context.fillText(`${detection.class}${detection.track_id ? ` #${detection.track_id}` : ' · untracked'} ${detection.confidence.toFixed(2)}`, x1, Math.max(14, y1 - 3))
      }
    }
  }
}
function coverageComplete() {
  const total = Math.ceil(analysis.input_duration_seconds)
  const covered = new Set(review.review_progress.reviewed_seconds)
  return total > 0 && Array.from({ length: total }, (_, i) => covered.has(i)).every(Boolean)
}
function hasUnresolvedEvents() {
  return review.events.some((event) => ['unreviewed', 'uncertain'].includes(event.review_status))
}
function renderCoverage() {
  const host = $('coverage'); host.replaceChildren()
  const duration = analysis.input_duration_seconds
  const covered = new Set(review.review_progress.reviewed_seconds)
  fullCoverage = coverageComplete()
  for (let start = 0; start < duration; start += 2) {
    const end = Math.min(duration, start + 2)
    const bins = Array.from({ length: Math.ceil(end) - Math.floor(start) }, (_, i) => Math.floor(start) + i)
    const candidates = analysis.crossing_events.filter((event) => event.timestamp_seconds >= start && event.timestamp_seconds < end).length
    const button = document.createElement('button')
    button.type = 'button'
    button.className = `coverage-window${bins.every((bin) => covered.has(bin)) ? ' reviewed' : ''}`
    button.textContent = `${start.toFixed(0)}–${end.toFixed(0)}s · ${candidates ? `${candidates} candidate(s)` : 'no candidates'}`
    button.addEventListener('click', () => playWindow(start, end))
    host.append(button)
  }
  $('coverage-status').textContent = `${covered.size}/${Math.ceil(duration)} seconds played continuously · ${analysis.crossing_events.length} model candidates. Playback coverage is only a review aid, not proof that labels are correct.`
  $('attest').disabled = !fullCoverage || hasUnresolvedEvents()
  $('attest').checked = review.review_progress.attested
  $('attest').title = $('attest').disabled ? 'Review every clip segment and resolve unreviewed/uncertain events first.' : 'Confirm that the whole video, including candidate-free intervals, was visually reviewed.'
}
function renderCandidates() {
  const host = $('candidates'); host.replaceChildren()
  for (const event of analysis.crossing_events) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = `Candidate ${event.timestamp_seconds.toFixed(2)}s · ${event.class}/${event.traffic_category} · track #${event.track_id} · ${event.direction}`
    button.title = 'Seek to a short review window. This prediction is not a label.'
    button.addEventListener('click', () => playWindow(Math.max(0, event.timestamp_seconds - 2), Math.min(analysis.input_duration_seconds, event.timestamp_seconds + 3)))
    host.append(button)
  }
}
function updateEvent(index, key, value) {
  const event = review.events[index]
  if (key === 'timestamp_seconds') {
    const time = Number(value)
    if (!Number.isFinite(time) || time < 0 || time > analysis.input_duration_seconds) return
    event.timestamp_seconds = time
    event.frame_index = frameForTimestamp(time, analysis.source_fps)
  } else event[key] = value
  event.reviewer = $('reviewer').value.trim()
  if (key !== 'reviewer_note') review.review_progress.attested = false
  save(); renderEvents(); renderCoverage()
}
function labeledSelect(values, selectedValue, onChange, placeholder) {
  const select = document.createElement('select')
  if (placeholder) {
    const option = document.createElement('option'); option.value = ''; option.textContent = placeholder; select.append(option)
  }
  for (const value of values) {
    const option = document.createElement('option'); option.value = value; option.textContent = value.replaceAll('_', ' '); select.append(option)
  }
  select.value = selectedValue ?? ''; select.addEventListener('change', () => onChange(select.value))
  return select
}
function renderEvents() {
  const host = $('events'); host.replaceChildren()
  if (!review.events.length) host.textContent = 'No human annotations yet. Candidate events above are not imported as annotations.'
  review.events.forEach((event, index) => {
    const row = document.createElement('div'); row.className = 'event-row'
    const id = document.createElement('strong'); id.textContent = `${event.event_id} · ${event.annotation_provenance}`; row.append(id)
    const time = document.createElement('input'); time.type = 'number'; time.min = '0'; time.max = String(analysis.input_duration_seconds); time.step = '0.001'; time.value = String(event.timestamp_seconds); time.title = 'Timestamp in source video seconds'
    time.addEventListener('change', () => updateEvent(index, 'timestamp_seconds', time.value)); row.append(time)
    row.append(labeledSelect(VEHICLE_CLASSES, event.vehicle_class, (value) => updateEvent(index, 'vehicle_class', value)))
    row.append(labeledSelect(DIRECTIONS, event.direction, (value) => updateEvent(index, 'direction', value)))
    row.append(labeledSelect(REVIEW_STATUSES, event.review_status, (value) => updateEvent(index, 'review_status', value)))
    row.append(labeledSelect(DIAGNOSTICS, event.diagnostic_category ?? 'unclassified', (value) => updateEvent(index, 'diagnostic_category', value), 'Tracker diagnosis (optional)'))
    const note = document.createElement('textarea'); note.placeholder = 'Reviewer note'; note.value = event.reviewer_note ?? ''; note.addEventListener('change', () => updateEvent(index, 'reviewer_note', note.value)); row.append(note)
    const frame = document.createElement('span'); frame.textContent = `frame ${event.frame_index}`; row.append(frame)
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remove'; remove.addEventListener('click', () => { review.events.splice(index, 1); review.review_progress.attested = false; save(); renderEvents(); renderCoverage() }); row.append(remove)
    host.append(row)
  })
}
function playWindow(start, end) {
  focusedWindowEnd = end
  video.currentTime = start
  video.play().catch(() => setStatus('Playback was blocked. Use the video controls to start the review window.'))
}
function download(name, content, type) {
  const link = document.createElement('a'); const url = URL.createObjectURL(new Blob([content], { type })); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0)
}
function addAnnotation() {
  const vehicleClass = $('new-class').value
  const direction = $('new-direction').value
  if (!vehicleClass || !direction || !$('reviewer').value.trim()) {
    setStatus('Choose a vehicle class and direction, and enter a reviewer ID before adding an annotation.')
    return
  }
  const event = {
    event_id: nextEventId(review.events), timestamp_seconds: Number(video.currentTime.toFixed(3)),
    frame_index: frameForTimestamp(video.currentTime, analysis.source_fps), vehicle_class: vehicleClass,
    direction, review_status: 'unreviewed', reviewer: $('reviewer').value.trim(), reviewer_note: '',
    annotation_provenance: 'human_video_review', diagnostic_category: 'unclassified',
  }
  const duplicate = possibleDuplicate(review.events, event)
  if (duplicate && !window.confirm(`Possible duplicate of ${duplicate.event_id} at ${duplicate.timestamp_seconds}s. Add anyway?`)) return
  review.events.push(event); review.review_progress.attested = false; save(); renderEvents(); renderCoverage()
  setStatus(`${event.event_id} added as Unreviewed. Confirm it only after visual review.`)
}
async function selectDemo(id) {
  selected = demos.find((item) => item.id === id)
  const [analysisResponse] = await Promise.all([fetch(selected.analysis)])
  if (!analysisResponse.ok) throw new Error(`Unable to read analysis data (${analysisResponse.status}).`)
  analysis = await analysisResponse.json()
  review = createReviewPackage(selected, analysis)
  const stored = localStorage.getItem(keyFor(review.video.id, review.video.source_sha256))
  if (stored) {
    try { review = validateReviewPackage(JSON.parse(stored), review.video) }
    catch (error) { setStatus(`Saved annotations were not loaded: ${error.message}`) }
  }
  $('reviewer').value = review.reviewer
  const quality = analysis.tracking_quality
  $('config-display').textContent = `Source: ${selected.title} (${analysis.video_dimensions.width}×${analysis.video_dimensions.height}, ${analysis.source_fps} FPS; sampled ${analysis.sampled_fps} FPS) · SHA-256 ${analysis.source_video_sha256} · ROI ${JSON.stringify(analysis.processing_config.roi_normalized)} · line ${JSON.stringify(analysis.processing_config.counting_line_normalized)} · ${analysis.crossing_events.length} candidates · ${analysis.tracked_objects_count} track IDs, ${quality.single_detection_track_count} single-sample, ${quality.tracks_with_gap_reacquisition} gap reacquisitions. Diagnostics are not accuracy scores.`
  video.pause(); video.src = selected.source; video.load(); previousPlaybackTime = null; focusedWindowEnd = null
  renderCandidates(); renderEvents(); renderCoverage(); updateTime()
}

for (const demo of demos) { const option = document.createElement('option'); option.value = demo.id; option.textContent = demo.title; $('video-select').append(option) }
$('video-select').addEventListener('change', () => selectDemo($('video-select').value).catch((error) => setStatus(error.message)))
$('reviewer').addEventListener('change', () => { if (review) { save(); renderEvents() } })
$('back-frame').addEventListener('click', () => { video.currentTime = Math.max(0, video.currentTime - 1 / analysis.source_fps) })
$('forward-frame').addEventListener('click', () => { video.currentTime = Math.min(video.duration, video.currentTime + 1 / analysis.source_fps) })
$('seek').addEventListener('change', () => { video.currentTime = Math.min(video.duration, Math.max(0, Number($('seek').value))) })
$('video').addEventListener('loadedmetadata', () => { canvas.width = video.videoWidth; canvas.height = video.videoHeight; updateTime() })
$('video').addEventListener('resize', drawOverlay)
$('model-overlay').addEventListener('change', drawOverlay)
$('video').addEventListener('seeking', () => { previousPlaybackTime = null })
$('video').addEventListener('timeupdate', () => {
  const current = video.currentTime
  if (previousPlaybackTime !== null) {
    const delta = current - previousPlaybackTime
    if (delta > 0 && delta <= Math.max(1.25, video.playbackRate * 1.25)) {
      const covered = new Set(review.review_progress.reviewed_seconds)
      for (let second = Math.floor(previousPlaybackTime); second < Math.ceil(current); second++) if (second >= 0 && second < Math.ceil(analysis.input_duration_seconds)) covered.add(second)
      review.review_progress.reviewed_seconds = [...covered]
      save(); renderCoverage()
    }
  }
  previousPlaybackTime = current
  updateTime()
  if (focusedWindowEnd !== null && current >= focusedWindowEnd) { video.pause(); focusedWindowEnd = null }
})
$('attest').addEventListener('change', () => { review.review_progress.attested = $('attest').checked; save(); renderCoverage() })
$('add-event').addEventListener('click', addAnnotation)
$('export-json').addEventListener('click', () => { save(); download(`${selected.id}.ground-truth-review.json`, `${JSON.stringify(review, null, 2)}\n`, 'application/json') })
$('export-csv').addEventListener('click', () => { save(); download(`${selected.id}.ground-truth-review.csv`, annotationsToCsv(review), 'text/csv') })
$('import-json').addEventListener('click', () => $('import-file').click())
$('import-file').addEventListener('change', async (event) => {
  const file = event.target.files?.[0]; if (!file) return
  try {
    review = validateReviewPackage(JSON.parse(await file.text()), review.video)
    $('reviewer').value = review.reviewer; save(); renderEvents(); renderCoverage(); setStatus('Review JSON imported and saved locally.')
  } catch (error) { setStatus(`Import failed: ${error.message}`) }
  event.target.value = ''
})

const addControls = document.createElement('div'); addControls.className = 'controls'
const classSelect = document.createElement('select'); classSelect.id = 'new-class'
classSelect.innerHTML = '<option value="">Select vehicle class</option>' + VEHICLE_CLASSES.map((value) => `<option value="${value}">${value}</option>`).join('')
const directionSelect = document.createElement('select'); directionSelect.id = 'new-direction'
directionSelect.innerHTML = '<option value="">Select direction</option>' + DIRECTIONS.map((value) => `<option value="${value}">${value.replaceAll('_', ' ')}</option>`).join('')
$('add-event').before(addControls); addControls.append(classSelect, directionSelect)

selectDemo(demos[0].id).catch((error) => setStatus(error.message))
