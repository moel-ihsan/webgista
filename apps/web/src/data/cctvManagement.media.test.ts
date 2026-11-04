import { describe, expect, it, vi } from 'vitest'

import { replaceCctvSnapshot } from './cctvManagement'

function jpeg(): File {
  return { type: 'image/jpeg', size: 3, slice: () => ({ arrayBuffer: async () => new Uint8Array([255, 216, 255]).buffer }) } as unknown as File
}

function clientMock(updated: { data: unknown; error: unknown }) {
  const query = { update: vi.fn(), eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn().mockResolvedValue(updated) }
  query.update.mockReturnValue(query); query.eq.mockReturnValue(query); query.select.mockReturnValue(query)
  const upload = vi.fn().mockResolvedValue({ error: null })
  const remove = vi.fn().mockResolvedValue({ error: null })
  const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: 'signed-url' }, error: null })
  const storage = { from: vi.fn(() => ({ upload, remove, createSignedUrl })) }
  return { client: { from: vi.fn(() => query), storage } as never, query, storage, upload, remove, createSignedUrl }
}

describe('CCTV private image replacement', () => {
  it('uploads privately, updates the exact camera pointer, removes the replaced object, then signs the new image', async () => {
    const mock = clientMock({ data: { id: 'camera-1' }, error: null })
    await expect(replaceCctvSnapshot(mock.client, 'camera-1', 'camera-1/old.webp', jpeg())).resolves.toEqual({
      path: expect.stringMatching(/^camera-1\/[0-9a-f-]+\.jpg$/i), url: 'signed-url',
    })
    const newPath = mock.upload.mock.calls[0]?.[0]
    expect(mock.storage.from).toHaveBeenCalledWith('cctv-images')
    expect(mock.upload).toHaveBeenCalledWith(newPath, expect.anything(), { cacheControl: '60', contentType: 'image/jpeg', upsert: false })
    expect(mock.query.update).toHaveBeenCalledWith({ snapshot_path: newPath })
    expect(mock.query.eq).toHaveBeenCalledWith('id', 'camera-1')
    expect(mock.remove).toHaveBeenCalledWith(['camera-1/old.webp'])
    expect(mock.createSignedUrl).toHaveBeenCalledWith(newPath, 300)
  })

  it('removes the new upload when the camera pointer update is denied or affects no row', async () => {
    const mock = clientMock({ data: null, error: null })
    await expect(replaceCctvSnapshot(mock.client, 'camera-1', 'camera-1/old.webp', jpeg())).rejects.toThrow('existing image reference is unchanged')
    expect(mock.remove).toHaveBeenCalledWith([mock.upload.mock.calls[0]?.[0]])
    expect(mock.createSignedUrl).not.toHaveBeenCalled()
  })
})
