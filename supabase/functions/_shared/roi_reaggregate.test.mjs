import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { reaggregate } from './roi_reaggregate.mjs'

for (const id of ['01', '02']) {
  test(`reaggregates demo ${id} into two complete ten-second windows and one partial window`, async () => {
    const document = JSON.parse(await readFile(new URL(`../../../apps/web/src/data/traffic-demo/traffic_sample_${id}.analysis.json`, import.meta.url)))
    const reviewed = JSON.parse(await readFile(new URL(`../../../apps/web/src/data/traffic-demo/traffic_sample_${id}.roi-density.json`, import.meta.url)))
    const result = reaggregate(document, reviewed.configuration_snapshot, reviewed.configuration_version)
    assert.equal(result.source_video_identifier, `traffic_sample_${id}`)
    assert.equal(result.source_video_sha256, document.source_video_sha256)
    assert.deepEqual(result.windows.map(row => row.status), ['complete', 'complete', 'partial'])
    assert.ok(Math.abs(result.windows[0].average_vehicles_present - reviewed.windows[0].average_vehicles_present) < 0.02)
    assert.equal(result.windows[0].data_quality.expected_samples, 50)
    assert.equal(result.windows[0].condition, null)
    assert.equal(result.windows[0].classification_status, 'no_data')
    for (let index = 0; index < reviewed.windows.length; index += 1) {
      assert.ok(Math.abs(result.windows[index].average_vehicles_present - reviewed.windows[index].average_vehicles_present) < 0.002)
      assert.equal(result.windows[index].peak_vehicles_present, reviewed.windows[index].peak_vehicles_present)
      assert.ok(Math.abs(result.windows[index].roi_image_coverage_average - reviewed.windows[index].roi_image_coverage_average) < 0.002)
    }
    assert.deepEqual(reaggregate(document, reviewed.configuration_snapshot, reviewed.configuration_version).windows, result.windows)
  })
}

test('rejects a detection artifact for a different video source', async () => {
  const document = JSON.parse(await readFile(new URL('../../../apps/web/src/data/traffic-demo/traffic_sample_01.analysis.json', import.meta.url)))
  const config = JSON.parse(await readFile(new URL('../../../apps/web/src/data/traffic-demo/traffic_sample_01.roi-density.json', import.meta.url))).configuration_snapshot
  assert.throws(() => reaggregate({ ...document, source_video_identifier: 'wrong-video' }, config, 1), /does not match/)
})

test('returns no valid condition for missing samples and rejects invalid boxes', async () => {
  const document = JSON.parse(await readFile(new URL('../../../apps/web/src/data/traffic-demo/traffic_sample_01.analysis.json', import.meta.url)))
  const config = JSON.parse(await readFile(new URL('../../../apps/web/src/data/traffic-demo/traffic_sample_01.roi-density.json', import.meta.url))).configuration_snapshot
  const empty = reaggregate({ ...document, frames: [] }, config, 2)
  assert.equal(empty.windows[0].classification_status, 'insufficient_coverage')
  assert.equal(empty.windows[0].condition, null)
  assert.throws(() => reaggregate({ ...document, frames: [{ offset_seconds: 0, detections: [{ class: 'car', confidence: 0.9, bbox_xyxy: [0, 0, 2000, 50] }] }] }, config, 2), /outside source/)
})
