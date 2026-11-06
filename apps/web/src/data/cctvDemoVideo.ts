import type { SupabaseClient } from '@supabase/supabase-js'

import { trafficDemoVideos, type TrafficDemoVideo } from './trafficDemo'
import { liveDemoStreamForCamera, type LiveDemoStream } from './liveDemoStreams'

export type TrafficDemoId = TrafficDemoVideo['id']

export interface CctvDemoAssociation {
  video: TrafficDemoVideo | null
  liveStream: LiveDemoStream | null
  editable: boolean
}

export function demoVideoForSource(sourceKind: unknown, sourceUri: unknown): TrafficDemoVideo | null {
  if (sourceKind !== 'stored_clip' || typeof sourceUri !== 'string') return null
  return trafficDemoVideos.find((video) => video.videoUrl === sourceUri) ?? null
}

async function knownDemoForCamera(client: SupabaseClient, cameraId: string): Promise<TrafficDemoVideo | null> {
  for (const video of trafficDemoVideos) {
    const { data, error } = await client.from('cctv_private_config').select('cctv_id')
      .eq('cctv_id', cameraId).eq('source_kind', 'stored_clip').eq('source_uri', video.videoUrl).maybeSingle()
    if (error) throw new Error('The authorized video association could not be checked.')
    if (data) return video
  }
  return null
}

export async function getCctvDemoAssociation(client: SupabaseClient, cameraId: string): Promise<CctvDemoAssociation> {
  const liveStream = liveDemoStreamForCamera(cameraId)
  if (liveStream) return { video: null, liveStream, editable: false }
  const { data, error } = await client.from('cctv_private_config').select('cctv_id').eq('cctv_id', cameraId).maybeSingle()
  if (error) throw new Error('The authorized video association could not be loaded.')
  if (!data) return { video: null, liveStream: null, editable: true }
  const video = await knownDemoForCamera(client, cameraId)
  return { video, liveStream: null, editable: video !== null }
}

export async function saveCctvDemoVideo(
  client: SupabaseClient,
  cameraId: string,
  userId: string,
  demoId: TrafficDemoId | null,
): Promise<void> {
  const { data: current, error: readError } = await client.from('cctv_private_config')
    .select('cctv_id').eq('cctv_id', cameraId).maybeSingle()
  if (readError) throw new Error('The authorized video association could not be checked.')

  const currentDemo = current ? await knownDemoForCamera(client, cameraId) : null
  if (current && !currentDemo) throw new Error('This camera has a separate private video configuration that this form cannot change.')
  if (!current && !demoId) return

  if (!demoId) {
    const { error } = await client.from('cctv_private_config').delete().eq('cctv_id', cameraId)
      .eq('source_kind', 'stored_clip').eq('source_uri', currentDemo!.videoUrl)
    if (error) throw new Error('The demo video association could not be removed.')
    return
  }

  const video = trafficDemoVideos.find(({ id }) => id === demoId)
  if (!video) throw new Error('Select a supported demo video.')
  if (!current && !userId) throw new Error('Sign in again before associating a demo video.')
  const values = {
    source_kind: 'stored_clip',
    source_uri: video.videoUrl,
    notes: `DEMO VIDEO — NOT LIVE CCTV. ${video.creator}; Pexels Free License. ${video.sourceUrl}`,
  }
  const result = current
    ? await client.from('cctv_private_config').update(values).eq('cctv_id', cameraId).select('cctv_id').maybeSingle()
    : await client.from('cctv_private_config').insert({ ...values, cctv_id: cameraId })
  if (result.error) {
    if (result.error.code === '42501') {
      throw new Error('The database denied permission to save the video association (42501).')
    }
    throw new Error('The demo video association could not be saved. Check your agency permissions.')
  }
  if (current && result.data?.cctv_id !== cameraId) throw new Error('The demo video association changed before it could be saved. Reload the CCTV form.')
}
