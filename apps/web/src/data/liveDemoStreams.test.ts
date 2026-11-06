import { describe, expect, it } from 'vitest'

import { attachLiveDemoStream, enforceLiveDemoNoData, listPublicDemoStreams, liveDemoStream, youtubeVideoId } from './liveDemoStreams'

const camera = {
  id: 'camera-1', legacyId: null, agency: { id: 'a', name: 'Agency' }, name: 'Demo CCTV', address: 'Banda Aceh',
  category: 'analytic' as const, longitude: 95, latitude: 5, snapshotUrl: null, publicStreamUrl: null, isActive: true,
}

describe('public YouTube demo sources', () => {
  it('accepts only secure canonical YouTube watch URLs and creates a no-cookie embed', () => {
    expect(youtubeVideoId(' https://www.youtube.com/watch?v=UTR-nG4SK7E ')).toBe('UTR-nG4SK7E')
    expect(liveDemoStream('camera-1', 'https://www.youtube.com/watch?v=BdPvBNLy5kc')).toMatchObject({
      videoId: 'BdPvBNLy5kc',
      sourceUrl: 'https://www.youtube.com/watch?v=BdPvBNLy5kc',
      embedUrl: 'https://www.youtube-nocookie.com/embed/BdPvBNLy5kc?autoplay=1&mute=1&playsinline=1&controls=1',
    })
    expect(youtubeVideoId('http://www.youtube.com/watch?v=UTR-nG4SK7E')).toBeNull()
    expect(youtubeVideoId('https://youtube.attacker.example/watch?v=UTR-nG4SK7E')).toBeNull()
    expect(youtubeVideoId('https://www.youtube.com/watch?v=short')).toBeNull()
  })

  it('sets only a configured YouTube camera to No Data and preserves its manual record elsewhere', () => {
    const manual = { ...camera, trafficCondition: 'terrible' as const, trafficConditionSource: 'manual' as const }
    const stream = liveDemoStream('camera-1', 'https://www.youtube.com/watch?v=UTR-nG4SK7E')
    const attached = attachLiveDemoStream(manual, stream)
    expect(attached).toMatchObject({ publicStreamUrl: stream?.sourceUrl, trafficCondition: null, trafficConditionSource: 'youtube_demo_unanalyzed' })
    expect(enforceLiveDemoNoData({ ...attached, trafficCondition: 'terrible', trafficConditionSource: 'manual' })).toMatchObject({
      trafficCondition: null, trafficConditionSource: 'youtube_demo_unanalyzed',
    })
    expect(manual.trafficCondition).toBe('terrible')
    expect(enforceLiveDemoNoData({ ...camera, trafficCondition: 'great' })).toMatchObject({ trafficCondition: 'great' })
  })

  it('loads only public camera and video IDs from the narrow projection', async () => {
    const query = {
      select: (fields: string) => { expect(fields).toBe('cctv_id,video_id'); return query },
      in: (column: string, ids: string[]) => { expect(column).toBe('cctv_id'); expect(ids).toEqual(['camera-1']); return query },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [
        { cctv_id: 'camera-1', video_id: 'UTR-nG4SK7E' },
        { cctv_id: 'camera-2', video_id: 'invalid' },
      ], error: null }).then(resolve),
    }
    const client = { from: (table: string) => { expect(table).toBe('public_cctv_demo_streams'); return query } } as never
    const streams = await listPublicDemoStreams(client, ['camera-1'])
    expect([...streams.keys()]).toEqual(['camera-1'])
    expect(streams.get('camera-1')).toMatchObject({ videoId: 'UTR-nG4SK7E' })
  })
})
