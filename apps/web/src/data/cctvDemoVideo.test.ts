import { describe, expect, it, vi } from 'vitest'

import { demoVideoForSource, getCctvDemoAssociation, saveCctvDemoVideo } from './cctvDemoVideo'
import { trafficDemoVideos } from './trafficDemo'

function cameraConfig(config: { cctv_id: string; source_kind: string; source_uri: string } | null, insertError: { code: string } | null = null) {
  const selectCalls: string[] = []
  const writes: unknown[] = []
  const from = vi.fn().mockImplementation(() => {
    let filters: Record<string, unknown> = {}
    interface Query {
      select(fields: string): Query
      eq(key: string, value: unknown): Query
      maybeSingle(): Promise<{ data: { cctv_id: string } | null; error: null }>
      insert(value: unknown): Promise<{ error: { code: string } | null }>
      update(value: unknown): Query
      delete(): Query
    }
    const query: Query = {
      select(fields) { selectCalls.push(fields); filters = {}; return this },
      eq(key, value) { filters[key] = value; return this },
      async maybeSingle() {
        if (!config || filters.cctv_id !== config.cctv_id) return { data: null, error: null }
        for (const [key, value] of Object.entries(filters)) {
          if (key !== 'cctv_id' && config[key as keyof typeof config] !== value) return { data: null, error: null }
        }
        return { data: { cctv_id: config.cctv_id }, error: null }
      },
      async insert(value) { writes.push(value); return { error: insertError } },
      update(value) { writes.push(value); return this },
      delete() { return this },
    }
    return query
  })
  return { client: { from } as never, from, selectCalls, writes }
}

describe('authorized demo-video association', () => {
  it('resolves only exact local allowlisted stored demo paths', () => {
    expect(demoVideoForSource('stored_clip', trafficDemoVideos[0]!.videoUrl)?.id).toBe('traffic-sample-01')
    expect(demoVideoForSource('private_stream', trafficDemoVideos[0]!.videoUrl)).toBeNull()
    expect(demoVideoForSource('stored_clip', 'https://attacker.example/video.mp4')).toBeNull()
    expect(demoVideoForSource('stored_clip', `${trafficDemoVideos[0]!.videoUrl}?token=secret`)).toBeNull()
  })

  it('returns only the camera id, does not select or reveal a private URI, and protects unknown configs', async () => {
    const absent = cameraConfig(null)
    await expect(getCctvDemoAssociation(absent.client, 'camera-1')).resolves.toEqual({ video: null, editable: true })
    const privateConfig = cameraConfig({ cctv_id: 'camera-1', source_kind: 'private_stream', source_uri: 'must-not-leak' })
    await expect(getCctvDemoAssociation(privateConfig.client, 'camera-1')).resolves.toEqual({ video: null, editable: false })
    expect(privateConfig.selectCalls).toEqual(['cctv_id', 'cctv_id', 'cctv_id'])
    expect(privateConfig.selectCalls.join(',')).not.toMatch(/source_uri|credential/i)
  })

  it('matches the second demo by server-side allowlist filter while returning no source URI', async () => {
    const sample = trafficDemoVideos[1]!
    const mock = cameraConfig({ cctv_id: 'camera-2', source_kind: 'stored_clip', source_uri: sample.videoUrl })
    await expect(getCctvDemoAssociation(mock.client, 'camera-2')).resolves.toMatchObject({ video: { id: sample.id }, editable: true })
    expect(mock.selectCalls.every((fields) => fields === 'cctv_id')).toBe(true)
  })

  it('stores only a selected demo asset with its provenance and leaves actor identity to the database trigger', async () => {
    const mock = cameraConfig(null)
    await saveCctvDemoVideo(mock.client, 'camera-1', 'user-1', 'traffic-sample-02')
    expect(mock.writes[0]).toEqual(expect.objectContaining({
      cctv_id: 'camera-1', source_kind: 'stored_clip',
      source_uri: '/traffic-demo/traffic_sample_02_annotated.mp4',
      notes: expect.stringContaining('DEMO VIDEO — NOT LIVE CCTV'),
    }))
    expect(mock.writes[0]).not.toHaveProperty('created_by')
    expect(JSON.stringify(mock.writes)).not.toMatch(/credential_reference|rtsp|password/i)
    await expect(saveCctvDemoVideo(mock.client, 'camera-1', 'user-1', 'https://unknown.example/a.mp4' as never))
      .rejects.toThrow('Select a supported demo video.')
  })

  it('refuses to replace a private source with a demo clip', async () => {
    const mock = cameraConfig({ cctv_id: 'camera-1', source_kind: 'private_stream', source_uri: 'private' })
    await expect(saveCctvDemoVideo(mock.client, 'camera-1', 'user-1', 'traffic-sample-01'))
      .rejects.toThrow('This camera has a separate private video configuration')
    expect(mock.writes).toHaveLength(0)
  })

  it('reports the confirmed missing database privilege without exposing private configuration', async () => {
    const mock = cameraConfig(null, { code: '42501' })
    await expect(saveCctvDemoVideo(mock.client, 'camera-1', 'user-1', 'traffic-sample-01'))
      .rejects.toThrow('The database denied permission to save the video association (42501).')
  })
})
