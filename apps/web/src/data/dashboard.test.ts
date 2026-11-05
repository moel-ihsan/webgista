import { describe, expect, it, vi } from 'vitest'

import { formatRecentDate, listRecentlyAddedCctv } from './dashboard'

function clientMock(result: { data: unknown; error: unknown }, signedUrl = 'private-signed-image', session: unknown = { user: { id: 'user-1' } }) {
  const query: Record<string, ReturnType<typeof vi.fn> | ((resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => unknown)> = {}
  for (const method of ['select', 'order', 'abortSignal']) query[method] = vi.fn().mockReturnValue(query)
  query.then = (resolve: (value: typeof result) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject)
  const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl }, error: null })
  const from = vi.fn().mockReturnValue(query)
  const client = {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session }, error: null }) },
    from,
    storage: { from: vi.fn(() => ({ createSignedUrl })) },
  } as never
  return { client, from, query, createSignedUrl }
}

describe('Dashboard data', () => {
  it('loads RLS-visible cameras by newest creation time and signs only private image paths', async () => {
    const mock = clientMock({ data: [
      { id: 'new', name: 'Newest', address: null, created_at: '2026-11-05T00:00:00Z', is_active: true, snapshot_path: 'camera-1/new.jpg' },
      { id: 'old', name: 'Older', created_at: '2026-11-01T00:00:00Z', is_active: false, snapshot_path: null },
    ], error: null })

    await expect(listRecentlyAddedCctv(mock.client, true)).resolves.toEqual([
      expect.objectContaining({ id: 'new', address: '', date: '2026-11-05T00:00:00Z', imageUrl: 'private-signed-image' }),
      expect.objectContaining({ id: 'old', isActive: false, imageUrl: null }),
    ])
    expect(mock.query.select).toHaveBeenCalledWith('id,name,address,created_at,is_active,snapshot_path')
    expect(mock.query.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(mock.createSignedUrl).toHaveBeenCalledWith('camera-1/new.jpg', 300)
  })

  it('uses only the public projection for anonymous Dashboard data without requesting restricted created_at', async () => {
    const mock = clientMock({ data: [{ id: 'public', name: 'Public CCTV', updated_at: '2026-11-05T00:00:00Z', snapshot_path: null }], error: null }, 'private-signed-image', null)
    await expect(listRecentlyAddedCctv(mock.client, false)).resolves.toEqual([
      expect.objectContaining({ id: 'public', date: '2026-11-05T00:00:00Z', isActive: true }),
    ])
    expect(mock.from).toHaveBeenCalledWith('public_cctv_locations')
    expect(mock.query.select).toHaveBeenCalledWith('id,name,address,updated_at,snapshot_path')
    expect(mock.query.select).not.toHaveBeenCalledWith(expect.stringContaining('created_at'))
    expect(mock.query.order).toHaveBeenCalledWith('updated_at', { ascending: false })
  })

  it('returns honest empty results, handles invalid rows, and reports query failure', async () => {
    await expect(listRecentlyAddedCctv(clientMock({ data: [], error: null }).client, false)).resolves.toEqual([])
    await expect(listRecentlyAddedCctv(clientMock({ data: [{ id: null }], error: null }).client, false)).resolves.toEqual([])
    await expect(listRecentlyAddedCctv(clientMock({ data: null, error: { message: 'private database detail' } }).client, false))
      .rejects.toThrow('Recently added CCTV could not be loaded.')
  })

  it('formats dates without exposing invalid timestamps', () => {
    expect(formatRecentDate('invalid')).toBe('Date unavailable')
    expect(formatRecentDate(new Date(Date.now() - 2 * 86_400_000).toISOString())).toBe('2 days ago')
  })
})
