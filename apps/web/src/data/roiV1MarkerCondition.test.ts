import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

import { classifyV1RoiWindow, latestV1RoiConditions, listLatestV1RoiConditions, mergeExperimentalRoiConditions, v1RoiRatio } from './roiV1MarkerCondition'

function windowWithRatio(ratio: number) {
  return {
    status: 'complete', window_duration_seconds: 10,
    traffic_category_statistics: { LV: { average: ratio * (4455 / 3600) / 0.1 }, HV: { average: 0 }, MC: { average: 0 } },
    data_quality: { valid_samples: 50, effective_observation_seconds: 10, valid_observation_coverage: 1 },
  }
}

describe('V1-compatible ROI marker estimate', () => {
  it('applies the v1 coefficients, denominator and inclusive category boundaries', () => {
    expect(classifyV1RoiWindow(windowWithRatio(0))).toBe('great')
    expect(classifyV1RoiWindow(windowWithRatio(0.6))).toBe('great')
    expect(classifyV1RoiWindow(windowWithRatio(0.6001))).toBe('good')
    expect(classifyV1RoiWindow(windowWithRatio(0.7))).toBe('good')
    expect(classifyV1RoiWindow(windowWithRatio(0.7001))).toBe('average')
    expect(classifyV1RoiWindow(windowWithRatio(0.8001))).toBe('poor')
    expect(classifyV1RoiWindow(windowWithRatio(0.9001))).toBe('bad')
    expect(classifyV1RoiWindow(windowWithRatio(1.0001))).toBe('terrible')
    const demoWindow = { ...windowWithRatio(0.4), traffic_category_statistics: { LV: { average: 3.2 }, HV: { average: 0.2 }, MC: { average: 3.4 } } }
    expect(v1RoiRatio(demoWindow)).toBeCloseTo((3.2 * 0.1 + 0.2 * 0.13 + 3.4 * 0.04) / (4455 / 3600))
    expect(classifyV1RoiWindow(demoWindow)).toBe('great')
  })

  it('rejects partial, insufficient, negative, and missing measurements as No Data', () => {
    const valid = windowWithRatio(0.4)
    expect(classifyV1RoiWindow({ ...valid, status: 'partial' })).toBeNull()
    expect(classifyV1RoiWindow({ ...valid, data_quality: { ...valid.data_quality, valid_samples: 49 } })).toBeNull()
    expect(classifyV1RoiWindow({ ...valid, traffic_category_statistics: { ...valid.traffic_category_statistics, LV: { average: -1 } } })).toBeNull()
    expect(classifyV1RoiWindow(null)).toBeNull()
  })

  it('uses only completed results matching current camera source, hash and ROI version', () => {
    const job = {
      id: 'job-3', cctv_id: 'camera-1', source_video_identifier: 'traffic_sample_02',
      source_video_sha256: '88f571acbd0f502f82c3e0f02a8f977ecf4a23f56debe68533f6026050a490ca',
      configuration_version: 3, analysis_method_version: 'roi_density_v1', status: 'completed',
      finished_at: '2026-11-06T10:00:00Z',
      cctv_roi_analysis_results: [{ job_id: 'job-3', window_ended_at_seconds: 10, summary: windowWithRatio(0.4) }],
    }
    const configs = [{ cctv_id: 'camera-1', configuration_version: 3 }]
    const associations = [{ cctv_id: 'camera-1', source_kind: 'stored_clip', source_uri: '/traffic-demo/traffic_sample_02_annotated.mp4' }]
    expect(latestV1RoiConditions([job], configs, associations).get('camera-1')).toEqual({ condition: 'great', source: 'experimental_v1_estimate' })
    expect(latestV1RoiConditions([{ ...job, configuration_version: 2 }], configs, associations).has('camera-1')).toBe(false)
    expect(latestV1RoiConditions([{ ...job, source_video_sha256: 'wrong' }], configs, associations).has('camera-1')).toBe(false)
    expect(latestV1RoiConditions([job], configs, []).has('camera-1')).toBe(false)
    const invalidWindowJob = { ...job, cctv_roi_analysis_results: [{ job_id: 'job-3', window_ended_at_seconds: 10, summary: { ...windowWithRatio(0.4), data_quality: { valid_samples: 20, effective_observation_seconds: 4, valid_observation_coverage: 0.4 } } }] }
    expect(latestV1RoiConditions([invalidWindowJob], configs, associations).get('camera-1')).toEqual({ condition: null, source: 'experimental_v1_estimate' })
  })

  it('lets the current experimental estimate supersede an old saved manual color without changing the observation', () => {
    const manual = new Map([['camera-1', { condition: 'great' as const, source: 'manual' as const }]])
    const currentRoi = new Map([['camera-1', { condition: 'bad' as const, source: 'experimental_v1_estimate' as const }]])
    expect(mergeExperimentalRoiConditions(manual, currentRoi).get('camera-1')).toEqual(currentRoi.get('camera-1'))
    expect(manual.get('camera-1')).toEqual({ condition: 'great', source: 'manual' })
    expect(mergeExperimentalRoiConditions(manual, new Map([['camera-1', { condition: null, source: 'experimental_v1_estimate' as const }]])).get('camera-1')?.condition).toBeNull()
  })

  it('loads results using separate RLS-scoped job and result reads', async () => {
    const job = {
      id: 'job-3', cctv_id: 'camera-1', source_video_identifier: 'traffic_sample_02',
      source_video_sha256: '88f571acbd0f502f82c3e0f02a8f977ecf4a23f56debe68533f6026050a490ca',
      configuration_version: 3, analysis_method_version: 'roi_density_v1', status: 'completed', finished_at: '2026-11-06T10:00:00Z',
    }
    const rows: Record<string, unknown[]> = {
      cctv_private_config: [{ cctv_id: 'camera-1', source_kind: 'stored_clip', source_uri: '/traffic-demo/traffic_sample_02_annotated.mp4' }],
      cctv_analysis_config: [{ cctv_id: 'camera-1', configuration_version: 3 }],
      cctv_roi_analysis_jobs: [job],
      cctv_roi_analysis_results: [{ job_id: 'job-3', window_ended_at_seconds: 20, summary: { ...windowWithRatio(0.4), traffic_category_statistics: { LV: { average: 3.2 }, HV: { average: 0.2 }, MC: { average: 3.4 } } } }],
    }
    const from = vi.fn((table: string) => {
      const query = {
        select: vi.fn(() => query), in: vi.fn(() => query), eq: vi.fn(() => query), order: vi.fn(() => query),
        limit: vi.fn(() => query), abortSignal: vi.fn(() => query),
        then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve({ data: rows[table], error: null }).then(resolve, reject),
      }
      return query
    })
    const client = { from } as unknown as SupabaseClient

    await expect(listLatestV1RoiConditions(client, ['camera-1'])).resolves.toEqual(new Map([
      ['camera-1', { condition: 'great', source: 'experimental_v1_estimate' }],
    ]))
    expect(from).toHaveBeenCalledWith('cctv_roi_analysis_results')
  })
})
