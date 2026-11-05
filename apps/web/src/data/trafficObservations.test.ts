import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

import { createManualTrafficObservation, latestTrafficConditions, listLatestTrafficObservations, validateManualObservation } from './trafficObservations'

const observation = (id: string, condition: string, ended: string) => ({
  id, cctv_id: 'camera-1', window_started_at: '2026-01-01T10:00:00Z', window_ended_at: ended,
  counting_method: 'manual', source_kind: 'manual', processing_status: 'completed', condition,
  light_vehicle_count: 2, heavy_vehicle_count: 1, motorcycle_count: 3, bicycle_count: 0,
  sampled_frames: 0, quality_flags: [],
})

describe('traffic observations', () => {
  it('keeps the first (latest-first) condition per camera', () => {
    const rows = [
      { id: 'new', cctvId: 'camera-1', condition: 'good' },
      { id: 'old', cctvId: 'camera-1', condition: 'poor' },
    ] as never
    expect(latestTrafficConditions(rows).get('camera-1')).toBe('good')
  })

  it('maps the restricted latest-observation view', async () => {
    const query = { select: vi.fn().mockReturnThis(), then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [observation('1', 'good', '2026-01-01T10:05:00Z')], error: null }).then(resolve) }
    const client = { from: vi.fn(() => query) } as unknown as SupabaseClient
    await expect(listLatestTrafficObservations(client)).resolves.toEqual([expect.objectContaining({ cctvId: 'camera-1', condition: 'good', sourceKind: 'manual' })])
    expect(client.from).toHaveBeenCalledWith('latest_traffic_observations')
  })

  it('rejects negative, fractional, and excessive manual counts', () => {
    const base = { cctvId: 'camera-1', condition: 'good' as const, lightVehicleCount: 0, heavyVehicleCount: 0, motorcycleCount: 0, bicycleCount: 0 }
    expect(validateManualObservation(base)).toBeNull()
    expect(validateManualObservation({ ...base, motorcycleCount: -1 })).toMatch(/whole numbers/)
    expect(validateManualObservation({ ...base, motorcycleCount: 1.5 })).toMatch(/whole numbers/)
    expect(validateManualObservation({ ...base, motorcycleCount: 1_000_001 })).toMatch(/whole numbers/)
  })

  it('saves manual observations with provenance and a five-minute window', async () => {
    const insert = vi.fn().mockReturnValue({ then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve) })
    const client = { from: vi.fn(() => ({ insert })) } as unknown as SupabaseClient
    const before = Date.now()
    await createManualTrafficObservation(client, { cctvId: 'camera-1', condition: 'average', lightVehicleCount: 2, heavyVehicleCount: 1, motorcycleCount: 3, bicycleCount: 0 })
    const payload = insert.mock.calls[0]?.[0] as Record<string, unknown>
    expect(payload).toMatchObject({ counting_method: 'manual', processing_status: 'completed', source_kind: 'manual', condition: 'average', sampled_frames: 0 })
    expect(Date.parse(payload.window_ended_at as string)).toBeGreaterThanOrEqual(before)
    expect(Date.parse(payload.window_ended_at as string) - Date.parse(payload.window_started_at as string)).toBe(300_000)
  })
})
