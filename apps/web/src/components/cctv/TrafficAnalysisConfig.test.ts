// @vitest-environment happy-dom
import { createApp, h, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const roiHarness = vi.hoisted(() => ({
  load: vi.fn(async () => null as unknown),
  save: vi.fn(async (_client: unknown, _cameraId: string, configuration: Record<string, unknown>) => ({
    configuration, configurationVersion: 3, updatedAt: '2026-11-06T00:00:00Z',
  })),
  schedule: vi.fn(async () => ({ job_id: 'job-1', status: 'completed' })),
  appConfig: { roiAnalysisEnabled: false },
}))

vi.mock('../../auth/session', () => ({ authSession: { state: { user: { id: 'admin-qa' } } } }))
vi.mock('../../lib/supabase', () => ({ supabaseClient: {} }))
vi.mock('../../data/cctvAnalysisConfig', () => ({
  getCctvAnalysisConfig: roiHarness.load,
  saveCctvAnalysisConfig: roiHarness.save,
}))
vi.mock('../../data/cctvRoiAnalysis', () => ({ scheduleCctvRoiAnalysis: roiHarness.schedule }))
vi.mock('../../config/app', () => ({ appConfig: roiHarness.appConfig }))

import { trafficDemoVideos } from '../../data/trafficDemo'
import { ROI_PROCESSING_DEFAULTS } from '../../domain/roiDensity'
import TrafficAnalysisConfig from './TrafficAnalysisConfig.vue'

let app: ReturnType<typeof createApp> | undefined
let host: HTMLElement | undefined

afterEach(() => {
  app?.unmount()
  host?.remove()
  app = undefined
  host = undefined
})

beforeEach(() => {
  roiHarness.load.mockReset()
  roiHarness.load.mockResolvedValue(null)
  roiHarness.save.mockClear()
  roiHarness.schedule.mockReset()
  roiHarness.schedule.mockResolvedValue({ job_id: 'job-1', status: 'completed' })
  roiHarness.appConfig.roiAnalysisEnabled = false
})

function drawPointer(type: string, x: number, y: number): Event {
  const event = new Event(type, { bubbles: true })
  Object.assign(event, { clientX: x, clientY: y, pointerId: 1 })
  return event
}

async function flush(): Promise<void> {
  for (let index = 0; index < 6; index += 1) { await Promise.resolve(); await nextTick() }
}

describe('TrafficAnalysisConfig', () => {
  it('shows only ROI drawing/editing actions and hides processing controls', async () => {
    host = document.createElement('div')
    document.body.append(host)
    app = createApp({
      render: () => h(TrafficAnalysisConfig, {
        cameraId: 'qa-camera', video: trafficDemoVideos[0]!, editable: true,
      }),
    })
    app.mount(host)
    host.querySelector('video')?.dispatchEvent(new Event('loadedmetadata'))
    await nextTick()

    expect([...host.querySelectorAll('button')].map((button) => button.textContent?.trim())).toEqual([
      'Draw Rectangle', 'Draw Polygon', 'Edit Area', 'Save ROI',
    ])
    expect(host.querySelectorAll('input, select, textarea')).toHaveLength(0)
    expect(host.querySelector('video')).not.toBeNull()
    expect(host.querySelector('svg[aria-label="Normalized detection area overlay"]')).not.toBeNull()
    expect(host.textContent).not.toMatch(/observation window|window refresh|sampling rate|confidence|busy threshold|sample coverage|vehicle classes included|average concurrent|capacity factor|equivalence coefficients|threshold status/i)
  })

  it('saves a normalized rectangle with fixed internal processing defaults', async () => {
    host = document.createElement('div')
    document.body.append(host)
    app = createApp({
      render: () => h(TrafficAnalysisConfig, {
        cameraId: 'qa-camera', video: trafficDemoVideos[0]!, editable: true,
      }),
    })
    app.mount(host)
    host.querySelector('video')?.dispatchEvent(new Event('loadedmetadata'))
    await nextTick()

    const svg = host.querySelector('svg')!
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 1000 } as DOMRect)
    svg.setPointerCapture = () => undefined
    host.querySelector<HTMLButtonElement>('button')!.click()
    svg.dispatchEvent(drawPointer('pointerdown', 100, 100))
    svg.dispatchEvent(drawPointer('pointermove', 800, 800))
    svg.dispatchEvent(drawPointer('pointerup', 800, 800))
    await nextTick()
    const editButton = [...host.querySelectorAll('button')].find((button) => button.textContent?.includes('Edit Area'))!
    editButton.click()
    host.querySelector('polygon')!.dispatchEvent(drawPointer('pointerdown', 400, 400))
    svg.dispatchEvent(drawPointer('pointermove', 500, 450))
    svg.dispatchEvent(drawPointer('pointerup', 500, 450))
    await nextTick()
    const saveButton = [...host.querySelectorAll('button')].find((button) => button.textContent?.includes('Save ROI'))!
    saveButton.click()
    await new Promise((resolve) => setTimeout(resolve, 0))
    await nextTick()

    expect(roiHarness.save).toHaveBeenCalledOnce()
    const configuration = roiHarness.save.mock.calls[0]![2]
    expect(configuration).toMatchObject({
      roi_type: 'rectangle',
      observation_window_seconds: 10, refresh_seconds: 10, sampled_fps: 5,
      included_classes: ['car', 'motorcycle', 'bus', 'truck'],
      minimum_detection_confidence: 0.35, density_thresholds: null,
    })
    const geometry = configuration.roi_geometry as number[]
    expect(geometry[0]).toBeCloseTo(0.2)
    expect(geometry[1]).toBeCloseTo(0.15)
    expect(geometry[2]).toBeCloseTo(0.7)
    expect(geometry[3]).toBeCloseTo(0.7)
    expect(host.textContent).toContain('ROI saved (configuration v3)')
  })

  it('schedules analysis after saving without adding analysis inputs', async () => {
    roiHarness.appConfig.roiAnalysisEnabled = true
    host = document.createElement('div')
    document.body.append(host)
    app = createApp({ render: () => h(TrafficAnalysisConfig, { cameraId: 'qa-camera', video: trafficDemoVideos[0]!, editable: true }) })
    app.mount(host)
    host.querySelector('video')?.dispatchEvent(new Event('loadedmetadata'))
    await flush()
    ;[...host.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.includes('Save ROI'))!.click()
    await new Promise(resolve => setTimeout(resolve, 0))
    await nextTick()
    expect(roiHarness.save).toHaveBeenCalledOnce()
    expect(roiHarness.schedule).toHaveBeenCalledWith({}, 'qa-camera')
    expect(host.textContent).toContain('Analysis completed')
  })

  it('keeps the saved ROI and reports scheduling failures separately', async () => {
    roiHarness.appConfig.roiAnalysisEnabled = true
    roiHarness.schedule.mockRejectedValue(new Error('ROI was saved, but analysis scheduling failed. Retry from Edit CCTV.'))
    host = document.createElement('div')
    document.body.append(host)
    app = createApp({ render: () => h(TrafficAnalysisConfig, { cameraId: 'qa-camera', video: trafficDemoVideos[0]!, editable: true }) })
    app.mount(host)
    host.querySelector('video')?.dispatchEvent(new Event('loadedmetadata'))
    await flush()
    ;[...host.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.includes('Save ROI'))!.click()
    await new Promise(resolve => setTimeout(resolve, 0))
    await nextTick()
    expect(roiHarness.save).toHaveBeenCalledOnce()
    expect(host.querySelector('video')).not.toBeNull()
    expect(host.textContent).toContain('ROI was saved, but analysis scheduling failed')
    expect(host.querySelector('[role="alert"]')).toBeNull()
  })

  it('restores the saved normalized ROI when the editor loads again', async () => {
    const video = trafficDemoVideos[0]!
    roiHarness.load.mockResolvedValue({
      configuration: {
        schema_version: 'webgista.roi-density-config.v1',
        source_video_identifier: video.analysis.source_video_identifier,
        roi_type: 'rectangle', roi_geometry: [0.2, 0.25, 0.6, 0.5],
        video_dimensions: video.analysis.video_dimensions,
        ...ROI_PROCESSING_DEFAULTS,
        included_classes: [...ROI_PROCESSING_DEFAULTS.included_classes],
      },
      configurationVersion: 8,
      updatedAt: '2026-11-06T00:00:00Z',
    })
    host = document.createElement('div')
    document.body.append(host)
    app = createApp({
      render: () => h(TrafficAnalysisConfig, { cameraId: 'qa-camera', video, editable: true }),
    })
    app.mount(host)
    await new Promise((resolve) => setTimeout(resolve, 0))
    await nextTick()

    expect(roiHarness.load).toHaveBeenCalledWith({}, 'qa-camera')
    expect(host.querySelector('polygon')?.getAttribute('points')).toBe('200,250 800,250 800,750 200,750')
    expect(host.textContent).toContain('Saved configuration v8')
  })

  it('finishes a valid polygon on double-click without an extra visible action', async () => {
    host = document.createElement('div')
    document.body.append(host)
    app = createApp({
      render: () => h(TrafficAnalysisConfig, {
        cameraId: 'qa-camera', video: trafficDemoVideos[0]!, editable: true,
      }),
    })
    app.mount(host)
    const svg = host.querySelector('svg')!
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 1000 } as DOMRect)
    svg.setPointerCapture = () => undefined
    const drawPolygon = [...host.querySelectorAll('button')].find((button) => button.textContent?.includes('Draw Polygon'))!
    drawPolygon.click()
    const vertices: [number, number][] = [[100, 100], [800, 100], [800, 800], [100, 800], [100, 800]]
    for (const [x, y] of vertices) {
      svg.dispatchEvent(drawPointer('pointerdown', x, y))
    }
    svg.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 100, clientY: 800 }))
    await nextTick()

    expect(host.querySelector('polygon')?.getAttribute('points')).toBe('100,100 800,100 800,800 100,800')
    expect([...host.querySelectorAll('button')].map((button) => button.textContent?.trim())).toEqual([
      'Draw Rectangle', 'Draw Polygon', 'Edit Area', 'Save ROI',
    ])
  })
})
