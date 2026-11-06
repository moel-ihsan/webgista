import test from 'node:test'
import assert from 'node:assert/strict'
import { claimRoiAnalysisJob } from './roi_job_claim.mjs'

function fakeService(status, startedAt) {
  const updates = []
  return {
    updates,
    from() {
      const filters = []
      const query = {
        update(values) { updates.push({ values, filters }); return query },
        eq(column, value) { filters.push(['eq', column, value]); return query },
        in(column, values) { filters.push(['in', column, values]); return query },
        lt(column, value) { filters.push(['lt', column, value]); return query },
        select() { return query },
        async maybeSingle() {
          const isFresh = filters.some(([op, column, values]) => op === 'in' && column === 'status' && values.includes(status))
          const isStale = status === 'processing' && filters.some(([op, column, value]) => op === 'lt' && column === 'started_at' && startedAt < value)
          if (isFresh || isStale) { status = 'processing'; startedAt = updates.at(-1).values.started_at; return { data: { id: 'job' }, error: null } }
          return { data: null, error: null }
        },
      }
      return query
    },
  }
}

test('claims pending and failed jobs once', async () => {
  for (const status of ['pending', 'failed']) {
    const service = fakeService(status)
    assert.deepEqual(await claimRoiAnalysisJob(service, 'job', Date.parse('2026-11-06T00:00:00Z')), { startedAt: '2026-11-06T00:00:00.000Z' })
    assert.equal(service.updates.length, 1)
  }
})

test('does not reclaim a recent processing job and reclaims only past the Edge runtime grace', async () => {
  const now = Date.parse('2026-11-06T00:05:00Z')
  const recent = fakeService('processing', new Date(now - 179_999).toISOString())
  assert.equal(await claimRoiAnalysisJob(recent, 'job', now), null)
  const stale = fakeService('processing', new Date(now - 180_001).toISOString())
  assert.deepEqual(await claimRoiAnalysisJob(stale, 'job', now), { startedAt: new Date(now).toISOString() })
  assert.equal(stale.updates.length, 2)
})

test('a worker interruption is recoverable on the next authorized claim after the runtime grace', async () => {
  const started = Date.parse('2026-11-06T00:00:00Z')
  const service = fakeService('pending')
  assert.deepEqual(await claimRoiAnalysisJob(service, 'job', started), { startedAt: new Date(started).toISOString() })
  assert.deepEqual(await claimRoiAnalysisJob(service, 'job', started + 180_001), { startedAt: new Date(started + 180_001).toISOString() })
  assert.equal(service.updates.length, 3)
})

test('a concurrent claimant that loses both compare-and-set updates does not start another worker', async () => {
  const service = {
    calls: 0,
    from() {
      const q = { update() { return q }, eq() { return q }, in() { return q }, lt() { return q }, select() { return q }, async maybeSingle() { service.calls++; return { data: null, error: null } } }
      return q
    },
  }
  assert.equal(await claimRoiAnalysisJob(service, 'job', Date.now()), null)
  assert.equal(service.calls, 2)
})

test('reports a claim storage failure instead of leaving the caller to assume processing', async () => {
  const service = { from() { const q = { update() { return q }, in() { return q }, eq() { return q }, select() { return q }, async maybeSingle() { return { data: null, error: new Error('db unavailable') } } }; return q } }
  await assert.rejects(claimRoiAnalysisJob(service, 'job'), /could not be claimed/)
})
