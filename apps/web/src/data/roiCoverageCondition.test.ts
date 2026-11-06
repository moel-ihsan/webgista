import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

import { latestAuthorizedConditionSnapshots, latestRoiCoverageConditions, conditionFromRoiCoverage, listLatestRoiCoverageConditions, type ConditionSnapshot } from './roiCoverageCondition'

function row(overrides: Record<string, unknown> = {}) {
  const job = {
    id: 'job-1', cctv_id: 'camera-1', source_video_identifier: 'traffic_sample_02', source_video_sha256: 'hash',
    configuration_version: 3, analysis_method_version: 'roi_density_v1', status: 'completed', finished_at: '2026-11-06T10:00:00Z',
    cctv_roi_analysis_results: [{
      job_id: 'job-1', window_ended_at_seconds: 10,
      summary: {
        configuration_version: 3, source_video_identifier: 'traffic_sample_02', source_video_sha256: 'hash',
        status: 'complete', roi_image_coverage_average: 0.269,
        data_quality: { valid_observation_coverage: 1 },
      },
    }],
  }
  return { ...job, ...overrides }
}

describe('experimental ROI coverage marker conditions', () => {
  it('uses the six v1 numeric boundaries on normalized ROI coverage and rejects invalid values', () => {
    expect([0, 0.6, 0.7, 0.8, 0.9, 1].map(conditionFromRoiCoverage)).toEqual(['great', 'good', 'average', 'poor', 'bad', 'terrible'])
    expect(conditionFromRoiCoverage(null)).toBeNull()
    expect(conditionFromRoiCoverage(-0.1)).toBeNull()
    expect(conditionFromRoiCoverage(1.01)).toBeNull()
    expect(conditionFromRoiCoverage(Number.NaN)).toBeNull()
  })

  it('uses only complete, adequately sampled results matching the current job source and ROI version', () => {
    const incomplete = row({
      cctv_roi_analysis_results: [
        ...row().cctv_roi_analysis_results,
        { job_id: 'job-1', window_ended_at_seconds: 26, summary: { ...row().cctv_roi_analysis_results[0]!.summary, status: 'partial', roi_image_coverage_average: 0.95 } },
      ],
    })
    const mismatched = row({ cctv_roi_analysis_results: [{ ...row().cctv_roi_analysis_results[0]!, summary: { ...row().cctv_roi_analysis_results[0]!.summary, configuration_version: 2 } }] })
    const results = latestRoiCoverageConditions([incomplete, mismatched, row()])
    expect(results.get('camera-1')).toMatchObject({ condition: 'great', source: 'experimental_roi_coverage' })
    expect(latestRoiCoverageConditions([row({ cctv_roi_analysis_results: [{ ...row().cctv_roi_analysis_results[0]!, summary: { ...row().cctv_roi_analysis_results[0]!.summary, data_quality: { valid_observation_coverage: 0.4 } } }] })]).size).toBe(0)
  })

  it('chooses the newest manual or ROI result without modifying observation records', () => {
    const observations = [{ cctvId: 'camera-1', condition: 'bad', windowEndedAt: '2026-11-06T09:00:00Z', sourceKind: 'manual' }]
    const roi = new Map<string, ConditionSnapshot>([['camera-1', { condition: 'great', source: 'experimental_roi_coverage', observedAt: '2026-11-06T10:00:00Z' }]])
    expect(latestAuthorizedConditionSnapshots(observations as never, roi).get('camera-1')).toMatchObject({ condition: 'great', source: 'experimental_roi_coverage' })
    expect(latestAuthorizedConditionSnapshots([{ ...observations[0]!, windowEndedAt: '2026-11-06T11:00:00Z' }] as never, roi).get('camera-1'))
      .toMatchObject({ condition: 'bad', source: 'manual' })
  })

  it('loads results through the authenticated RLS-scoped tables and returns the mapped condition', async () => {
    const query = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(), abortSignal: vi.fn().mockReturnThis(),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [row()], error: null }).then(resolve),
    }
    const client = { from: vi.fn(() => query) } as unknown as SupabaseClient
    await expect(listLatestRoiCoverageConditions(client)).resolves.toMatchObject(new Map([['camera-1', { condition: 'great' }]]))
    expect(client.from).toHaveBeenCalledWith('cctv_roi_analysis_jobs')
    expect(query.eq).toHaveBeenCalledWith('status', 'completed')
    expect(query.eq).toHaveBeenCalledWith('analysis_method_version', 'roi_density_v1')
  })
})
