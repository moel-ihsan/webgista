import { describe, expect, it } from 'vitest'

import { demoDetectionTotal, demoFrameAt, trafficDemoVideos } from './trafficDemo'

describe('offline traffic CV demos', () => {
  it('uses the two processed sample outputs and keeps demo limits explicit', () => {
    expect(trafficDemoVideos.map(({ analysis }) => demoDetectionTotal(analysis))).toEqual([110, 186])
    for (const sample of trafficDemoVideos) {
      expect(sample.analysis).toMatchObject({
        record_kind: 'demo_video_analysis',
        is_live_cctv: false,
        tracking: { enabled: false },
        condition: null,
      })
    }
  })

  it('selects only the latest sampled frame at or before playback time', () => {
    const analysis = trafficDemoVideos[0]!.analysis
    expect(demoFrameAt(analysis, 0)?.offset_seconds).toBe(0)
    expect(demoFrameAt(analysis, 4)?.offset_seconds).toBeLessThanOrEqual(4)
    expect(demoFrameAt(analysis, 4)?.offset_seconds).toBeGreaterThan(3)
    expect(demoFrameAt(analysis, -1)).toBeNull()
  })
})
