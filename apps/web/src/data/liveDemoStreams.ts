import type { SupabaseClient } from '@supabase/supabase-js'

import type { CctvLocation } from '../domain/cctv'

export interface LiveDemoStream {
  cameraId: string
  videoId: string
  title: string
  sourceUrl: string
  embedUrl: string
}

export function youtubeVideoId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:' || url.hostname !== 'www.youtube.com' || url.pathname !== '/watch') return null
    const id = url.searchParams.get('v')
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null
  } catch {
    return null
  }
}

export function liveDemoStream(cameraId: string, value: unknown): LiveDemoStream | null {
  const videoId = youtubeVideoId(value)
  if (!videoId) return null
  return {
    cameraId,
    videoId,
    title: 'YouTube live demo',
    sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&playsinline=1&controls=1`,
  }
}

export async function listPublicDemoStreams(client: SupabaseClient, cameraIds: readonly string[], signal?: AbortSignal): Promise<ReadonlyMap<string, LiveDemoStream>> {
  if (!cameraIds.length) return new Map()
  let query = client.from('public_cctv_demo_streams').select('cctv_id,video_id').in('cctv_id', [...cameraIds])
  if (signal) query = query.abortSignal(signal)
  const { data, error } = await query
  if (signal?.aborted) return new Map()
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') return new Map()
    throw new Error('Public demo video sources could not be loaded.')
  }
  return new Map((data ?? []).flatMap((row) => {
    if (typeof row.cctv_id !== 'string' || typeof row.video_id !== 'string') return []
    const stream = liveDemoStream(row.cctv_id, `https://www.youtube.com/watch?v=${row.video_id}`)
    return stream ? [[row.cctv_id, stream] as const] : []
  }))
}

export function attachLiveDemoStream(location: CctvLocation, stream: LiveDemoStream | null): CctvLocation {
  if (!stream) return location
  return { ...location, publicStreamUrl: stream.sourceUrl, trafficCondition: null, trafficConditionSource: 'youtube_demo_unanalyzed' }
}

export function enforceLiveDemoNoData(location: CctvLocation): CctvLocation {
  return liveDemoStream(location.id, location.publicStreamUrl)
    ? { ...location, trafficCondition: null, trafficConditionSource: 'youtube_demo_unanalyzed' }
    : location
}
