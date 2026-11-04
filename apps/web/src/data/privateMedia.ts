import type { SupabaseClient } from '@supabase/supabase-js'

export type ImageBucket = 'profile-photos' | 'cctv-images'

export async function validateImage(file: File, maxBytes: number): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPEG, PNG, or WebP image.')
  if (file.size === 0 || file.size > maxBytes) throw new Error(`Image must be smaller than ${Math.floor(maxBytes / 1024 / 1024)} MB.`)
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
  const webp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  if (!(file.type === 'image/jpeg' && jpeg) && !(file.type === 'image/png' && png) && !(file.type === 'image/webp' && webp)) {
    throw new Error('The selected file is not a valid image of the chosen type.')
  }
  return file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp'
}

export async function uploadPrivateImage(
  client: SupabaseClient,
  bucket: ImageBucket,
  ownerId: string,
  file: File,
  maxBytes: number,
): Promise<string> {
  const extension = await validateImage(file, maxBytes)
  const path = `${ownerId}/${crypto.randomUUID()}.${extension}`
  const { error } = await client.storage.from(bucket).upload(path, file, { cacheControl: '60', contentType: file.type, upsert: false })
  if (error) throw new Error('Image could not be uploaded. Check your access and try again.')
  return path
}

export async function privateImageUrl(client: SupabaseClient, bucket: ImageBucket, path: string | null): Promise<string | null> {
  if (!path) return null
  const { data, error } = await client.storage.from(bucket).createSignedUrl(path, 300)
  if (error || !data?.signedUrl) throw new Error('Image preview could not be loaded.')
  return data.signedUrl
}

export async function removePrivateImage(client: SupabaseClient, bucket: ImageBucket, path: string | null): Promise<void> {
  if (!path) return
  const { error } = await client.storage.from(bucket).remove([path])
  if (error) throw new Error('The previous image could not be removed.')
}
