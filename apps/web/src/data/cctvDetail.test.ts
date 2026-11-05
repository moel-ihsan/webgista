import { describe, expect, it, vi } from 'vitest'

import { getCctvDetail } from './cctvDetail'

function clientFor(result: { data: unknown; error: unknown }) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  }
  const from = vi.fn().mockReturnValue(query)
  return { client: { from } as never, from, query }
}

describe('CCTV detail data access', () => {
  it('uses the public security-invoker view for visitors and returns only its public projection', async () => {
    const mock = clientFor({ data: {
      id: 'camera-1', name: 'Test Camera', address: 'Banda Aceh', category: 'regular',
      agency_name: 'Public Agency', longitude: 95.3, latitude: 5.5, snapshot_path: null,
    }, error: null })

    await expect(getCctvDetail(mock.client, 'camera-1', false)).resolves.toEqual(expect.objectContaining({
      id: 'camera-1', agencyName: 'Public Agency', longitude: 95.3, latitude: 5.5,
    }))
    expect(mock.from).toHaveBeenCalledWith('public_cctv_locations')
    expect(mock.query.select).toHaveBeenCalledWith('id,name,address,category,agency_name,longitude,latitude,snapshot_path')
    expect(mock.query.select.mock.calls[0]?.[0]).not.toMatch(/source_uri|credential|url/i)
  })

  it('uses authenticated RLS for authorized details without selecting private stream configuration', async () => {
    const mock = clientFor({ data: {
      id: 'private-1', name: 'Private Camera', address: 'Banda Aceh', category: 'analytic', agency_id: 'agency-1',
      agency: { name: 'Agency' }, longitude: '95.3', latitude: '5.5', snapshot_path: 'private-1/image.jpg',
    }, error: null })

    await expect(getCctvDetail(mock.client, 'private-1', true)).resolves.toMatchObject({
      id: 'private-1', agencyName: 'Agency', category: 'analytic', snapshotPath: 'private-1/image.jpg',
    })
    expect(mock.from).toHaveBeenCalledWith('cctv_locations')
    expect(mock.query.select.mock.calls[0]?.[0]).not.toMatch(/source_uri|credential|url/i)
  })

  it('does not reveal whether a missing row is private or nonexistent and rejects invalid coordinates', async () => {
    await expect(getCctvDetail(clientFor({ data: null, error: null }).client, 'camera-1', true)).resolves.toBeNull()
    await expect(getCctvDetail(clientFor({ data: {
      id: 'camera-1', name: 'Camera', address: '', category: 'regular', longitude: 181, latitude: 5.5, snapshot_path: null,
    }, error: null }).client, 'camera-1', false)).resolves.toBeNull()
  })
})
