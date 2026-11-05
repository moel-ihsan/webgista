import { describe, expect, it } from 'vitest'

import { demoDetectionTotal, demoFrameAt, trafficDemoVideos } from './trafficDemo'

describe('offline traffic CV demos', () => {
  it('uses the two processed sample outputs and keeps demo limits explicit', () => {
    expect(trafficDemoVideos.map(({ analysis }) => analysis.schema_version)).toEqual([
      'webgista.traffic-analysis.v2', 'webgista.traffic-analysis.v2',
    ])
    expect(trafficDemoVideos.map(({ analysis }) => demoDetectionTotal(analysis))).toEqual([540, 901])
    expect(trafficDemoVideos.map(({ analysis }) => analysis.tracked_objects_count)).toEqual([35, 263])
    expect(trafficDemoVideos.map(({ analysis }) => analysis.crossing_event_count)).toEqual([4, 25])
    for (const sample of trafficDemoVideos) {
      expect(sample.analysis).toMatchObject({
        record_kind: 'demo_video_analysis',
        is_live_cctv: false,
        tracking: { enabled: true, quality: 'experimental; not ground-truth validated' },
        tracking_quality: { status: 'not_ground_truth_validated' },
        ground_truth_status: 'not_available',
        condition: null,
      })
      expect(sample.analysis.processed_frame_count).toBe(sample.analysis.frames.length)
      expect(sample.analysis.crossing_event_count).toBe(sample.analysis.crossing_events.length)
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
