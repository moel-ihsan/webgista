import { describe, expect, it, vi } from 'vitest'

import { uploadPrivateImage, validateImage } from './privateMedia'

function imageFile(type: string, header: number[]): File {
  return {
    type,
    size: header.length,
    slice: () => ({ arrayBuffer: async () => new Uint8Array(header).buffer }),
  } as unknown as File
}

describe('private image validation and upload', () => {
  it('validates image signatures, MIME types, and size before storage upload', async () => {
    await expect(validateImage(imageFile('image/jpeg', [255, 216, 255]), 100)).resolves.toBe('jpg')
    await expect(validateImage(imageFile('image/jpeg', [1, 2, 3]), 100)).rejects.toThrow('not a valid image')
    await expect(validateImage(imageFile('image/svg+xml', [60, 115, 118]), 100)).rejects.toThrow('JPEG, PNG, or WebP')
    await expect(validateImage({ ...imageFile('image/jpeg', [255, 216, 255]), size: 101 } as File, 100)).rejects.toThrow('smaller than')
  })

  it('uploads to a collision-resistant owner-scoped path without upsert', async () => {
    const upload = vi.fn().mockResolvedValue({ error: null })
    const client = { storage: { from: vi.fn(() => ({ upload })) } } as never
    const path = await uploadPrivateImage(client, 'profile-photos', 'user-1', imageFile('image/jpeg', [255, 216, 255]), 100)
    expect(path).toMatch(/^user-1\/[0-9a-f-]+\.jpg$/i)
    expect(upload).toHaveBeenCalledWith(path, expect.anything(), { cacheControl: '60', contentType: 'image/jpeg', upsert: false })
  })
})
