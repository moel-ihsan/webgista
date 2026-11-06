import type { SupabaseClient } from '@supabase/supabase-js'

import { trafficDemoVideos, type TrafficDemoVideo } from './trafficDemo'
import { listPublicDemoStreams, liveDemoStream, youtubeVideoId, type LiveDemoStream } from './liveDemoStreams'

export type TrafficDemoId = TrafficDemoVideo['id']

export interface CctvDemoAssociation {
  video: TrafficDemoVideo | null
  liveStream: LiveDemoStream | null
  sourceUrl: string
  editable: boolean
}

export function demoVideoForSource(sourceKind: unknown, sourceUri: unknown): TrafficDemoVideo | null {
  if (sourceKind !== 'stored_clip' || typeof sourceUri !== 'string') return null
  return trafficDemoVideos.find((video) => video.videoUrl === sourceUri) ?? null
}

export function canonicalYoutubeDemoUrl(value: string): string | null {
  const id = youtubeVideoId(value)
  return id ? `https://www.youtube.com/watch?v=${id}` : null
}

async function knownDemoForCamera(client: SupabaseClient, cameraId: string): Promise<TrafficDemoVideo | null> {
  for (const video of trafficDemoVideos) {
    const { data, error } = await client.from('cctv_private_config').select('cctv_id')
      .eq('cctv_id', cameraId).eq('source_kind', 'stored_clip').eq('source_uri', video.videoUrl).maybeSingle()
    if (error) throw new Error('The authorized demo video association could not be checked.')
    if (data) return video
  }
  return null
}

export async function getCctvDemoAssociation(client: SupabaseClient, cameraId: string): Promise<CctvDemoAssociation> {
  const { data, error } = await client.from('cctv_private_config').select('cctv_id').eq('cctv_id', cameraId).maybeSingle()
  if (error) throw new Error('The authorized video association could not be loaded.')
  if (!data) return { video: null, liveStream: null, sourceUrl: '', editable: true }
  const video = await knownDemoForCamera(client, cameraId)
  if (video) return { video, liveStream: null, sourceUrl: '', editable: true }
  const { data: youtube, error: youtubeError } = await client.from('cctv_private_config').select('cctv_id,source_uri')
    .eq('cctv_id', cameraId).eq('source_kind', 'public_https')
    .filter('source_uri', 'match', '^https://www\\.youtube\\.com/watch\\?v=[A-Za-z0-9_-]{11}$').maybeSingle()
  if (youtubeError) throw new Error('The authorized YouTube demo source could not be loaded.')
  const liveStream = youtube ? liveDemoStream(cameraId, youtube.source_uri) : null
  return {
    video: null,
    liveStream,
    sourceUrl: liveStream?.sourceUrl ?? '',
    editable: liveStream !== null,
  }
}

export async function getPublicCctvDemoStream(client: SupabaseClient, cameraId: string): Promise<LiveDemoStream | null> {
  return (await listPublicDemoStreams(client, [cameraId])).get(cameraId) ?? null
}

export async function saveCctvDemoSource(
  client: SupabaseClient,
  cameraId: string,
  url: string | null,
): Promise<void> {
  const { data: present, error: readError } = await client.from('cctv_private_config').select('cctv_id').eq('cctv_id', cameraId).maybeSingle()
  if (readError) throw new Error('The authorized video association could not be checked.')
  const current = await getCctvDemoAssociation(client, cameraId)
  if (present && !current.editable) throw new Error('This camera has a separate private video configuration that this form cannot change.')

  if (url === null) {
    if (!present) return
    const { error } = await client.from('cctv_private_config').delete().eq('cctv_id', cameraId)
    if (error) throw new Error('The demo video association could not be removed.')
    return
  }

  const sourceUrl = canonicalYoutubeDemoUrl(url)
  if (!sourceUrl) throw new Error('Enter a valid YouTube video link.')
  const values = { source_kind: 'public_https', source_uri: sourceUrl, credential_reference: null, notes: 'Public YouTube demo video' }
  const result = present
    ? await client.from('cctv_private_config').update(values).eq('cctv_id', cameraId).select('cctv_id').maybeSingle()
    : await client.from('cctv_private_config').insert({ ...values, cctv_id: cameraId })
  if (result.error) {
    if (result.error.code === '42501') throw new Error('Your account cannot save a video source for this camera.')
    throw new Error('The YouTube demo link could not be saved. Check your agency permissions.')
  }
  if (present && result.data?.cctv_id !== cameraId) throw new Error('The video association changed before it could be saved. Reload the CCTV form.')
}

export async function listAuthorizedYoutubeDemoStreams(client: SupabaseClient, cameraIds: readonly string[]): Promise<ReadonlyMap<string, LiveDemoStream>> {
  if (!cameraIds.length) return new Map()
  const { data, error } = await client.from('cctv_private_config').select('cctv_id,source_uri')
    .in('cctv_id', [...cameraIds]).eq('source_kind', 'public_https')
    .filter('source_uri', 'match', '^https://www\\.youtube\\.com/watch\\?v=[A-Za-z0-9_-]{11}$')
  if (error) throw new Error('Authorized demo video sources could not be loaded.')
  return new Map((data ?? []).flatMap((row) => {
    if (typeof row.cctv_id !== 'string') return []
    const stream = liveDemoStream(row.cctv_id, row.source_uri)
    return stream ? [[row.cctv_id, stream] as const] : []
  }))
}
