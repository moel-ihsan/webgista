// @vitest-environment happy-dom
import { createApp, nextTick } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { getCctvDetail, getCctvDemoAssociation, getCctvAnalysisConfig, getCurrentCctvRoiAnalysis, listTrafficObservations, privateImageUrl, authState, appConfigState } = vi.hoisted(() => ({
  getCctvDetail: vi.fn(),
  getCctvDemoAssociation: vi.fn(),
  getCctvAnalysisConfig: vi.fn(),
  getCurrentCctvRoiAnalysis: vi.fn(),
  listTrafficObservations: vi.fn(),
  privateImageUrl: vi.fn(),
  authState: { status: 'authenticated' as string },
  appConfigState: { privateMediaEnabled: true, roiDensityEnabled: false, roiAnalysisEnabled: false },
}))

vi.mock('../auth/session', () => ({ authSession: { state: authState } }))
vi.mock('../config/app', () => ({ appConfig: appConfigState }))
vi.mock('../lib/supabase', () => ({ supabaseClient: {} }))
vi.mock('../data/cctvDetail', () => ({ getCctvDetail }))
vi.mock('../data/cctvDemoVideo', () => ({ getCctvDemoAssociation }))
vi.mock('../data/cctvAnalysisConfig', () => ({ getCctvAnalysisConfig }))
vi.mock('../data/cctvRoiAnalysis', () => ({ getCurrentCctvRoiAnalysis }))
vi.mock('../data/trafficObservations', () => ({ listTrafficObservations }))
vi.mock('../data/privateMedia', () => ({ privateImageUrl }))

import CctvDetailPage from './CctvDetailPage.vue'

let app: ReturnType<typeof createApp> | undefined
let host: HTMLDivElement | undefined

async function flush(): Promise<void> {
  for (let index = 0; index < 6; index += 1) { await Promise.resolve(); await nextTick() }
}

function mountPage() {
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/cctv/:id', name: 'cctv-detail', component: CctvDetailPage },
    { path: '/map', name: 'map', component: { template: '<div />' } },
  ] })
  return router.push('/cctv/camera-1').then(async () => {
    await router.isReady()
    host = document.createElement('div')
    app = createApp(RouterView)
    app.use(router)
    app.mount(host)
    await flush()
  })
}

beforeEach(() => {
  authState.status = 'authenticated'
  getCctvDetail.mockReset().mockResolvedValue({
    id: 'camera-1', name: 'Simpang Jambo Tape', address: 'Banda Aceh', category: 'regular',
    agencyName: 'Test Agency', longitude: 95.330911, latitude: 5.559729, snapshotPath: 'camera-1/photo.jpg',
  })
  listTrafficObservations.mockReset().mockResolvedValue([{
    id: 'observation-1', cctvId: 'camera-1', windowStartedAt: '2026-11-05T09:00:00Z', windowEndedAt: '2026-11-05T09:05:00Z',
    condition: 'poor', countingMethod: 'manual', sourceKind: 'manual', lightVehicleCount: 2, heavyVehicleCount: 0,
    motorcycleCount: 1, bicycleCount: 0, sampledFrames: 0, qualityFlags: [],
  }])
  getCctvDemoAssociation.mockReset().mockResolvedValue({ video: null, editable: true })
  privateImageUrl.mockReset().mockResolvedValue('signed-photo')
  getCctvAnalysisConfig.mockReset().mockResolvedValue(null)
  getCurrentCctvRoiAnalysis.mockReset().mockResolvedValue(null)
  appConfigState.roiDensityEnabled = false
  appConfigState.roiAnalysisEnabled = false
})

afterEach(() => {
  app?.unmount()
  host?.remove()
  app = undefined
  host = undefined
})

describe('CCTV detail page', () => {
  it('shows the authorized image, saved camera metadata, latest observation, and real history', async () => {
    await mountPage()

    expect(getCctvDetail).toHaveBeenCalledWith({}, 'camera-1', true)
    expect(privateImageUrl).toHaveBeenCalledWith({}, 'cctv-images', 'camera-1/photo.jpg')
    expect(host?.querySelector('.cctv-detail-media > img')?.getAttribute('src')).toBe('signed-photo')
    expect(host?.textContent).toContain('Simpang Jambo Tape')
    expect(host?.textContent).toContain('Test Agency')
    expect(host?.textContent).toContain('Poor')
    expect(host?.textContent).toContain('Manual')
    expect(host?.textContent).toContain('Observation History')
    expect(host?.querySelector('.cctv-detail-actions a')?.getAttribute('href')).toBe('/map?cctv=camera-1')
  })

  it('renders a YouTube demo stream with a short demo label', async () => {
    getCctvDemoAssociation.mockResolvedValue({
      video: null,
      editable: false,
      liveStream: {
        cameraId: 'camera-1', videoId: 'UTR-nG4SK7E', title: 'YouTube live demo',
        sourceUrl: 'https://www.youtube.com/watch?v=UTR-nG4SK7E',
        embedUrl: 'https://www.youtube-nocookie.com/embed/UTR-nG4SK7E?autoplay=1&mute=1&playsinline=1&controls=1',
      },
    })
    await mountPage()

    const frame = host?.querySelector<HTMLIFrameElement>('.cctv-detail-live-stage iframe')
    expect(frame?.src).toContain('/embed/UTR-nG4SK7E?autoplay=1')
    expect(frame?.allow).toContain('autoplay')
    expect(host?.textContent).toContain('DEMO · YOUTUBE LIVE')
    expect(host?.querySelector('.cctv-detail-cv')).toBeNull()
  })

  it('shows No Data and an honest video fallback when no saved observation or image is available', async () => {
    getCctvDetail.mockResolvedValue({
      id: 'camera-1', name: 'Analytic Camera', address: 'Banda Aceh', category: 'analytic',
      agencyName: 'Agency', longitude: 95.3, latitude: 5.5, snapshotPath: null,
    })
    listTrafficObservations.mockResolvedValue([])
    await mountPage()

    expect(host?.textContent).toContain('No Data')
    expect(host?.textContent).toContain('No authorized playable video')
    expect(host?.querySelector('video')).toBeNull()
  })

  it('plays annotated detections, omits line-crossing statistics, and falls back to the image on error', async () => {
    const { trafficDemoVideos } = await import('../data/trafficDemo')
    getCctvDemoAssociation.mockResolvedValue({ video: trafficDemoVideos[1], editable: true })
    await mountPage()

    const video = host?.querySelector('.cctv-detail-media video')
    expect(video?.getAttribute('src')).toBe('/traffic-demo/traffic_sample_02_annotated.mp4?v=roi-density-20261106')
    expect(host?.querySelector('.cctv-detail-media > img')).toBeNull()
    expect(host?.textContent).toContain('DEMO VIDEO — NOT LIVE CCTV')
    expect(host?.textContent).not.toContain('line-crossing')
    expect(host?.textContent).not.toContain('heuristic track IDs')
    expect(host?.textContent).not.toContain('Average Vehicles')
    expect(host?.querySelector('.cctv-detail-roi polygon')).toBeNull()
    expect(host?.textContent).toContain('does not depict current traffic at this camera location')

    video?.dispatchEvent(new Event('error'))
    await flush()
    expect(host?.querySelector('.cctv-detail-media video')).toBeNull()
    expect(host?.querySelector('.cctv-detail-media > img')?.getAttribute('src')).toBe('signed-photo')
    expect(host?.textContent).toContain('Showing the uploaded CCTV image')
  })

  it('never queries private video configuration for anonymous visitors', async () => {
    authState.status = 'anonymous'
    await mountPage()
    expect(getCctvDemoAssociation).not.toHaveBeenCalled()
    expect(host?.querySelector('video')).toBeNull()
    authState.status = 'authenticated'
  })

  it('withholds stale ROI statistics when an authorized camera has changed its saved ROI', async () => {
    const { trafficDemoVideos } = await import('../data/trafficDemo')
    const video = trafficDemoVideos[0]!
    appConfigState.roiDensityEnabled = true
    getCctvDemoAssociation.mockResolvedValue({ video, editable: true })
    getCctvAnalysisConfig.mockResolvedValue({
      configuration: { ...video.roiDensity.configuration_snapshot, roi_geometry: [0.1, 0.1, 0.5, 0.5] },
      configurationVersion: 2,
      updatedAt: '2026-11-06T00:00:00Z',
    })
    await mountPage()

    expect(getCctvAnalysisConfig).toHaveBeenCalledWith({}, 'camera-1')
    expect(host?.textContent).toContain('Analysis Stale')
    expect(host?.textContent).not.toContain('10-second ROI window')
    expect(host?.textContent).not.toContain('Average Vehicles:')
    expect(host?.querySelector('.cctv-detail-roi polygon')?.getAttribute('points')).toContain('100.00,100.00')
  })

  it('uses the authorized saved ROI for overlay and only shows matching density metrics', async () => {
    const { trafficDemoVideos } = await import('../data/trafficDemo')
    const video = trafficDemoVideos[0]!
    appConfigState.roiDensityEnabled = true
    getCctvDemoAssociation.mockResolvedValue({ video, editable: true })
    getCctvAnalysisConfig.mockResolvedValue({
      configuration: video.roiDensity.configuration_snapshot,
      configurationVersion: video.roiDensity.configuration_version,
      updatedAt: '2026-11-06T00:00:00Z',
    })
    await mountPage()

    expect(getCctvAnalysisConfig).toHaveBeenCalledWith({}, 'camera-1')
    expect(host?.querySelector('.cctv-detail-roi polygon')?.getAttribute('points')).toBe('550.00,480.00 990.00,480.00 990.00,910.00 550.00,910.00')
    expect(host?.textContent).toContain('ROI Detection at')
    expect(host?.textContent).toContain('Average Vehicles:')
    expect(host?.textContent).toContain('Peak:')
    expect(host?.textContent).toContain('Observation Duration: 10.0 seconds')
    expect(host?.textContent).toContain('Vehicle Classes')
    expect(host?.textContent).toContain('ROI Coverage:')
    expect(host?.textContent).toContain('Measurement Status:')
    expect(host?.textContent).not.toContain('line-crossing')
    expect(host?.querySelector('video')?.getAttribute('controlslist')).toBe('nofullscreen')
    expect(host?.querySelector('.cctv-detail-video-stage')?.contains(host.querySelector('.cctv-detail-roi'))).toBe(true)
  })

  it('renders the matching persisted result window as playback moves through all three intervals', async () => {
    const { trafficDemoVideos } = await import('../data/trafficDemo')
    const video = trafficDemoVideos[1]!
    const result = (start: number, end: number, average: number, peak: number, status: 'complete' | 'partial', valid: number) => ({
      window_started_at_seconds: start, window_ended_at_seconds: end, window_duration_seconds: end - start, status,
      classification_status: 'no_data' as const, condition: null, condition_reason: 'MKJI unavailable',
      average_vehicles_present: average, peak_vehicles_present: peak,
      class_statistics: {},
      traffic_category_statistics: { LV: { average, peak }, HV: { average: 0, peak: 0 }, MC: { average: 0, peak: 0 }, bicycle: { average: 0, peak: 0 } },
      roi_image_coverage_average: 0.269, busy_duration_seconds: 9.8, busy_duration_percentage: 98,
      data_quality: { expected_samples: valid, valid_samples: valid, missing_samples: 0, effective_observation_seconds: end - start, valid_observation_coverage: 1, processing_fps: 5, sample_period_seconds: 0.2 },
    })
    appConfigState.roiDensityEnabled = true
    appConfigState.roiAnalysisEnabled = true
    getCctvDemoAssociation.mockResolvedValue({ video, editable: true })
    getCctvAnalysisConfig.mockResolvedValue({
      configuration: video.roiDensity.configuration_snapshot,
      configurationVersion: 3,
      updatedAt: '2026-11-06T09:00:00Z',
    })
    getCurrentCctvRoiAnalysis.mockResolvedValue({
      jobId: 'job-3', status: 'completed', failureReason: null,
      results: [result(0, 10, 6.8, 12, 'complete', 50), result(10, 20, 7.24, 14, 'complete', 50), result(20, 26, 5.4334, 11, 'partial', 30)],
    })
    await mountPage()

    expect(getCurrentCctvRoiAnalysis).toHaveBeenCalledWith({}, 'camera-1', 'traffic_sample_02', video.analysis.source_video_sha256, 3)
    expect(host?.textContent).toContain('Analysis Ready')
    const player = host?.querySelector<HTMLVideoElement>('.cctv-detail-media video')
    expect(player).not.toBeNull()
    for (const [time, interval, average, peak, completeness] of [
      [4, '0–10 seconds', '6.80', '12', 'complete'],
      [15, '10–20 seconds', '7.24', '14', 'complete'],
      [23, '20–26 seconds', '5.43', '11', 'partial'],
    ]) {
      player!.currentTime = time as number
      player!.dispatchEvent(new Event('timeupdate'))
      await flush()
      expect(host?.textContent).toContain(`Observation interval: ${interval} · ${completeness}.`)
      expect(host?.textContent).toContain(`Average Vehicles: ${average} · Peak: ${peak}`)
      expect(host?.textContent).toContain('V1-style marker estimate:')
    }
    player!.currentTime = 23
    player!.dispatchEvent(new Event('timeupdate'))
    await flush()
    expect(host?.textContent).toContain('V1-style marker estimate: No Data — valid complete ROI window unavailable')
  })

  it('withholds the bundled demo ROI when no authorized camera configuration is returned', async () => {
    const { trafficDemoVideos } = await import('../data/trafficDemo')
    appConfigState.roiDensityEnabled = true
    getCctvDemoAssociation.mockResolvedValue({ video: trafficDemoVideos[0], editable: true })
    getCctvAnalysisConfig.mockResolvedValue(null)
    await mountPage()

    expect(host?.querySelector('.cctv-detail-roi')).toBeNull()
    expect(host?.textContent).toContain('No authorized camera ROI is available')
    expect(host?.textContent).not.toContain('Average Vehicles:')
  })

  it('renders the currently saved polygon in normalized video coordinates at any stage size', async () => {
    const { trafficDemoVideos } = await import('../data/trafficDemo')
    const video = trafficDemoVideos[0]!
    appConfigState.roiDensityEnabled = true
    getCctvDemoAssociation.mockResolvedValue({ video, editable: true })
    getCctvAnalysisConfig.mockResolvedValue({
      configuration: { ...video.roiDensity.configuration_snapshot, roi_type: 'polygon', roi_geometry: [[.1, .2], [.7, .2], [.6, .8], [.2, .9]] },
      configurationVersion: 2,
      updatedAt: '2026-11-06T00:00:00Z',
    })
    await mountPage()

    const stage = host?.querySelector('.cctv-detail-video-content') as HTMLDivElement
    const polygon = stage.querySelector('polygon')
    expect(polygon?.getAttribute('points')).toBe('100.00,200.00 700.00,200.00 600.00,800.00 200.00,900.00')
    expect(stage.style.aspectRatio).toBe('1280 / 720')
    expect(stage.querySelector('video')).not.toBeNull()
    expect(host?.textContent).toContain('Analysis Stale')
    expect(host?.textContent).not.toContain('Average Vehicles:')
  })

  it('requests fullscreen on the video stage so the saved ROI stays with the video', async () => {
    const { trafficDemoVideos } = await import('../data/trafficDemo')
    appConfigState.roiDensityEnabled = true
    getCctvDemoAssociation.mockResolvedValue({ video: trafficDemoVideos[0], editable: true })
    getCctvAnalysisConfig.mockResolvedValue({
      configuration: trafficDemoVideos[0]!.roiDensity.configuration_snapshot,
      configurationVersion: 1,
      updatedAt: '2026-11-06T00:00:00Z',
    })
    await mountPage()
    const stage = host?.querySelector('.cctv-detail-video-stage') as HTMLDivElement
    const requestFullscreen = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(stage, 'requestFullscreen', { configurable: true, value: requestFullscreen })
    host?.querySelector<HTMLButtonElement>('.cctv-detail-fullscreen')?.click()
    await flush()

    expect(requestFullscreen).toHaveBeenCalledOnce()
    expect(stage.querySelector('video')).not.toBeNull()
    expect(stage.querySelector('.cctv-detail-roi')).not.toBeNull()
  })

  it('waits for the authorized video lookup before rendering the image fallback', async () => {
    let resolveAssociation: ((value: { video: null; editable: boolean }) => void) | undefined
    getCctvDemoAssociation.mockReturnValue(new Promise((resolve) => { resolveAssociation = resolve }))
    await mountPage()
    expect(host?.querySelector('.cctv-detail-media > img')).toBeNull()
    expect(host?.textContent).toContain('Checking authorized video source')
    resolveAssociation?.({ video: null, editable: true })
    await flush()
    expect(host?.querySelector('.cctv-detail-media > img')?.getAttribute('src')).toBe('signed-photo')
  })

  it('uses the same neutral not-found state for absent and RLS-hidden camera rows', async () => {
    getCctvDetail.mockResolvedValue(null)
    await mountPage()
    expect(host?.textContent).toContain('CCTV location not found or not available to this account.')
  })
})
