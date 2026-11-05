// @vitest-environment happy-dom
import { createApp, nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'

import TrafficDemoPanel from './TrafficDemoPanel.vue'

let app: ReturnType<typeof createApp> | undefined
let host: HTMLElement | undefined

afterEach(() => {
  app?.unmount()
  host?.remove()
  app = undefined
  host = undefined
})

describe('TrafficDemoPanel', () => {
  it('plays the selected annotated sample and follows sampled-frame results', async () => {
    host = document.createElement('div')
    document.body.append(host)
    app = createApp(TrafficDemoPanel)
    app.mount(host)

    const select = host.querySelector<HTMLSelectElement>('#traffic-demo-select')!
    expect(host.querySelector('video')?.getAttribute('src')).toBe('/traffic-demo/traffic_sample_01_annotated.mp4')
    expect(host.textContent).toContain('110 across 23 sampled frames')
    expect(host.textContent).toContain('DEMO · NOT LIVE CCTV')

    select.value = 'traffic-sample-02'
    select.dispatchEvent(new Event('change'))
    await nextTick()
    expect(host.querySelector('video')?.getAttribute('src')).toBe('/traffic-demo/traffic_sample_02_annotated.mp4')
    expect(host.textContent).toContain('186 across 26 sampled frames')

    const video = host.querySelector<HTMLVideoElement>('video')!
    Object.defineProperty(video, 'currentTime', { configurable: true, value: 4 })
    video.dispatchEvent(new Event('timeupdate'))
    await nextTick()
    expect(host.textContent).toContain('Frame at 4.0 sec')
    expect(host.textContent).toContain('confidence')
    expect(host.textContent).toContain('not unique vehicles')
  })
})
