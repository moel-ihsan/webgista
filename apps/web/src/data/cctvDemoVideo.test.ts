import { describe, expect, it, vi } from 'vitest'

import { canonicalYoutubeDemoUrl, demoVideoForSource, getCctvDemoAssociation, saveCctvDemoSource } from './cctvDemoVideo'
import { trafficDemoVideos } from './trafficDemo'

function cameraConfig(config: { cctv_id: string; source_kind: string; source_uri: string } | null, writeError: { code: string } | null = null) {
  const selects: { fields: string; filters: Record<string, unknown> }[] = []
  const requests: { fields: string; filters: Record<string, unknown> }[] = []
  const writes: unknown[] = []
  const from = vi.fn().mockImplementation(() => {
    const filters: Record<string, unknown> = {}
    let selected = 'cctv_id'
    const query = {
      select(fields: string) { selects.push({ fields, filters: { ...filters } }); selected = fields; return query },
      eq(key: string, value: unknown) { filters[key] = value; return query },
      match(key: string, value: unknown) { filters[key] = value; return query },
      filter(key: string, _operator: string, value: unknown) { filters[key] = value; return query },
      in() { return query },
      async maybeSingle() {
        requests.push({ fields: selected, filters: { ...filters } })
        if (!config) return { data: null, error: null }
        for (const [key, value] of Object.entries(filters)) {
          if (key === 'source_uri' && typeof value === 'string' && value.startsWith('^')) {
            if (!new RegExp(value).test(config.source_uri)) return { data: null, error: null }
          } else if (key !== 'cctv_id' && config[key as keyof typeof config] !== value) return { data: null, error: null }
        }
        return { data: selected === 'cctv_id' ? { cctv_id: config.cctv_id } : config, error: null }
      },
      async insert(value: unknown) { writes.push(value); return { data: null, error: writeError } },
      update(value: unknown) { writes.push(value); return query },
      async delete() { writes.push('delete'); return { error: writeError } },
    }
    return query
  })
  return { client: { from } as never, from, selects, requests, writes }
}

describe('YouTube and offline demo CCTV sources', () => {
  it('resolves only exact bundled offline paths and canonicalizes YouTube watch URLs', () => {
    expect(demoVideoForSource('stored_clip', trafficDemoVideos[0]!.videoUrl)?.id).toBe('traffic-sample-01')
    expect(demoVideoForSource('private_stream', trafficDemoVideos[0]!.videoUrl)).toBeNull()
    expect(demoVideoForSource('stored_clip', `${trafficDemoVideos[0]!.videoUrl}?token=secret`)).toBeNull()
    expect(canonicalYoutubeDemoUrl('https://www.youtube.com/watch?v=BdPvBNLy5kc&feature=share')).toBe('https://www.youtube.com/watch?v=BdPvBNLy5kc')
    expect(canonicalYoutubeDemoUrl('https://attacker.example/watch?v=BdPvBNLy5kc')).toBeNull()
  })

  it('does not reveal unknown private source URIs to the form', async () => {
    const hidden = cameraConfig({ cctv_id: 'camera-1', source_kind: 'private_stream', source_uri: 'rtsp://secret' })
    await expect(getCctvDemoAssociation(hidden.client, 'camera-1')).resolves.toMatchObject({ video: null, liveStream: null, sourceUrl: '', editable: false })
    expect(hidden.requests.filter(({ fields }) => fields === 'cctv_id,source_uri')).toEqual([expect.objectContaining({
      filters: expect.objectContaining({
        source_kind: 'public_https',
        source_uri: '^https://www\\.youtube\\.com/watch\\?v=[A-Za-z0-9_-]{11}$',
      }),
    })])
  })

  it('loads an authorized Pexels clip through its exact path without returning the source URI', async () => {
    const clip = trafficDemoVideos[1]!
    const mock = cameraConfig({ cctv_id: 'camera-2', source_kind: 'stored_clip', source_uri: clip.videoUrl })
    await expect(getCctvDemoAssociation(mock.client, 'camera-2')).resolves.toMatchObject({ video: { id: clip.id }, liveStream: null, editable: true })
    expect(mock.selects).not.toContain('cctv_id,source_uri')
  })

  it('loads only an exact safe YouTube URL into the authorized editor', async () => {
    const url = 'https://www.youtube.com/watch?v=UTR-nG4SK7E'
    const mock = cameraConfig({ cctv_id: 'camera-1', source_kind: 'public_https', source_uri: url })
    await expect(getCctvDemoAssociation(mock.client, 'camera-1')).resolves.toMatchObject({
      liveStream: { videoId: 'UTR-nG4SK7E', embedUrl: expect.stringContaining('youtube-nocookie.com') },
      sourceUrl: url,
      editable: true,
    })
  })

  it('saves a canonical YouTube link in the existing RLS-protected source row', async () => {
    const mock = cameraConfig(null)
    await saveCctvDemoSource(mock.client, 'camera-1', 'https://www.youtube.com/watch?v=BdPvBNLy5kc&feature=share')
    expect(mock.writes[0]).toEqual({
      cctv_id: 'camera-1', source_kind: 'public_https', source_uri: 'https://www.youtube.com/watch?v=BdPvBNLy5kc',
      credential_reference: null, notes: 'Public YouTube demo video',
    })
  })

  it('rejects arbitrary URLs before database writes', async () => {
    const mock = cameraConfig(null)
    await expect(saveCctvDemoSource(mock.client, 'camera-1', 'https://attacker.example/video.mp4')).rejects.toThrow('Enter a valid YouTube video link.')
    expect(mock.writes).toHaveLength(0)
  })

  it('refuses to replace a private camera configuration', async () => {
    const mock = cameraConfig({ cctv_id: 'camera-1', source_kind: 'private_stream', source_uri: 'rtsp://secret' })
    await expect(saveCctvDemoSource(mock.client, 'camera-1', 'https://www.youtube.com/watch?v=UTR-nG4SK7E'))
      .rejects.toThrow('This camera has a separate private video configuration')
    expect(mock.writes).toHaveLength(0)
  })

  it('reports denied storage permission without pretending the URL was saved', async () => {
    const mock = cameraConfig(null, { code: '42501' })
    await expect(saveCctvDemoSource(mock.client, 'camera-1', 'https://www.youtube.com/watch?v=UTR-nG4SK7E'))
      .rejects.toThrow('Your account cannot save a video source for this camera.')
  })
})
