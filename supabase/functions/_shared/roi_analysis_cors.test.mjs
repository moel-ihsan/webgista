import assert from 'node:assert/strict'
import test from 'node:test'
import { roiAnalysisCorsHeaders } from './roi_analysis_cors.mjs'

test('matches production and exact local origins in CORS responses', () => {
  for (const origin of ['https://webgista-v2.vercel.app', 'http://localhost:5173', 'http://localhost:5174']) {
    assert.equal(roiAnalysisCorsHeaders(origin)['Access-Control-Allow-Origin'], origin)
  }
})

test('omits CORS access for unapproved origins', () => {
  assert.equal('Access-Control-Allow-Origin' in roiAnalysisCorsHeaders('https://example.org'), false)
})

test('uses the production origin for requests without an Origin header', () => {
  assert.equal(roiAnalysisCorsHeaders(null)['Access-Control-Allow-Origin'], 'https://webgista-v2.vercel.app')
})
