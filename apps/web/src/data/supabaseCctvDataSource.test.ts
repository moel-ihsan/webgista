import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

import { createSupabaseCctvDataSource } from './supabaseCctvDataSource'

const camera = {
  id: 'camera-1',
  name: 'Kuta Alam',
  address: null,
  category: 'analytic',
  agency_id: 'agency-1',
  agency_name: 'Dishub',
  longitude: 95.3238,
  latitude: 5.5483,
}

function clientMock(session: unknown, result: { data: unknown; error: unknown }) {
  const selectedFields: string[] = []
  const query = {
    select: vi.fn((fields: string) => {
      selectedFields.push(fields)
      return query
    }),
    eq: vi.fn(() => query),
    abortSignal: vi.fn(() => query),
    then: (resolve: (value: typeof result) => unknown, reject?: (error: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }
  const from = vi.fn(() => query)
  const client = {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session }, error: null }) },
    from,
  } as unknown as SupabaseClient
  return { client, from, query, selectedFields }
}

describe('Supabase CCTV data source', () => {
  it('reads anonymous cameras only from the public projection and maps safe fields', async () => {
    const mock = clientMock(null, { data: [camera], error: null })
    const locations = await createSupabaseCctvDataSource(mock.client).listLocations(new AbortController().signal)

    expect(mock.from).toHaveBeenCalledWith('public_cctv_locations')
    expect(mock.query.select).toHaveBeenCalledWith(expect.stringContaining('agency_name'))
    expect(mock.selectedFields[0]).toMatch(/snapshot_path/)
    expect(mock.selectedFields[0]).not.toMatch(/private|stream|credential|source_uri/)
    expect(locations).toEqual([expect.objectContaining({
      id: 'camera-1',
      agency: { id: 'agency-1', name: 'Dishub' },
      address: '',
      publicStreamUrl: null,
      snapshotUrl: null,
    })])
  })

  it('uses RLS-scoped camera rows for signed-in users without selecting private configuration', async () => {
    const mock = clientMock({ user: { id: 'user-1' } }, {
      data: [{ ...camera, agency_name: undefined, agency: { id: 'agency-1', name: 'Dishub' }, is_active: true }],
      error: null,
    })
    const source = createSupabaseCctvDataSource(mock.client)

    await expect(source.listLocations()).resolves.toHaveLength(1)
    expect(mock.from).toHaveBeenCalledWith('cctv_locations')
    expect(mock.query.eq).toHaveBeenCalledWith('is_active', true)
    expect(mock.selectedFields[0]).not.toMatch(/private|stream|credential|source_uri/)
  })

  it('returns an empty list for no visible rows and rejects query errors', async () => {
    const empty = clientMock(null, { data: [], error: null })
    await expect(createSupabaseCctvDataSource(empty.client).listLocations()).resolves.toEqual([])

    const failed = clientMock(null, { data: null, error: { message: 'sensitive internal detail' } })
    await expect(createSupabaseCctvDataSource(failed.client).listLocations())
      .rejects.toThrow('CCTV locations could not be loaded.')
  })

  it('never treats a private Storage object path as a browser image URL when media is disabled', async () => {
    const mock = clientMock(null, { data: [{ ...camera, snapshot_path: 'camera-1/private.webp' }], error: null })
    const locations = await createSupabaseCctvDataSource(mock.client).listLocations()
    expect(locations[0]?.snapshotUrl).toBeNull()
  })

  it('excludes invalid coordinates and malformed required data', async () => {
    const mock = clientMock(null, {
      data: [
        camera,
        { ...camera, id: 'bad-lng', longitude: Infinity },
        { ...camera, id: 'bad-lat', latitude: 91 },
        { ...camera, id: 'missing-agency', agency_id: null },
        { ...camera, id: 'inactive', is_active: false },
      ],
      error: null,
    })

    await expect(createSupabaseCctvDataSource(mock.client).listLocations()).resolves.toHaveLength(1)
  })

  it('does not start a camera query when authentication restoration was cancelled', async () => {
    let finishSession: (value: { data: { session: null }; error: null }) => void = () => undefined
    const client = {
      auth: { getSession: vi.fn(() => new Promise((resolve) => { finishSession = resolve })) },
      from: vi.fn(),
    } as unknown as SupabaseClient
    const controller = new AbortController()
    const result = createSupabaseCctvDataSource(client).listLocations(controller.signal)
    controller.abort()
    finishSession({ data: { session: null }, error: null })

    await expect(result).resolves.toEqual([])
    expect(client.from).not.toHaveBeenCalled()
  })
})
