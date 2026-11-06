import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

import { getCurrentCctvRoiAnalysis } from './cctvRoiAnalysis'

describe('CCTV ROI analysis results', () => {
  it('loads all saved windows for the exact camera, source, hash, and ROI version', async () => {
    const windows = [0, 10, 20].map((start) => ({ window_started_at_seconds: start, window_ended_at_seconds: start + 10 }))
    const jobQuery = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'job-3', status: 'completed', failure_reason: null, configuration_version: 3 }, error: null }),
    }
    const resultsQuery = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: windows.map((summary) => ({ summary })), error: null }).then(resolve),
    }
    const client = { from: vi.fn((table: string) => table === 'cctv_roi_analysis_jobs' ? jobQuery : resultsQuery) } as unknown as SupabaseClient

    const result = await getCurrentCctvRoiAnalysis(client, 'camera-1', 'traffic_sample_02', 'video-hash', 3)

    expect(result?.results.map(({ window_started_at_seconds }) => window_started_at_seconds)).toEqual([0, 10, 20])
    expect(result?.results).toHaveLength(3)
    expect(client.from).toHaveBeenCalledWith('cctv_roi_analysis_results')
    expect(resultsQuery.eq).toHaveBeenCalledWith('job_id', 'job-3')
    expect(resultsQuery.order).toHaveBeenCalledWith('window_started_at_seconds')
  })
})
