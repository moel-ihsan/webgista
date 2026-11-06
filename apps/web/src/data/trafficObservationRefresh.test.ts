// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'

import { TRAFFIC_OBSERVATION_SAVED_EVENT } from './trafficObservations'
import { watchTrafficObservationChanges } from './trafficObservationRefresh'

describe('traffic observation map refresh', () => {
  afterEach(() => vi.useRealTimers())

  it('refreshes on save, visible-tab return, and at most once per 30-second interval; then cleans up', () => {
    vi.useFakeTimers()
    const refresh = vi.fn()
    const stop = watchTrafficObservationChanges(refresh)

    window.dispatchEvent(new Event(TRAFFIC_OBSERVATION_SAVED_EVENT))
    expect(refresh).toHaveBeenCalledOnce()

    document.dispatchEvent(new Event('visibilitychange'))
    expect(refresh).toHaveBeenCalledTimes(2)

    vi.advanceTimersByTime(30_000)
    expect(refresh).toHaveBeenCalledTimes(3)

    stop()
    window.dispatchEvent(new Event(TRAFFIC_OBSERVATION_SAVED_EVENT))
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(60_000)
    expect(refresh).toHaveBeenCalledTimes(3)
  })

  it('skips refreshes while the document is hidden', () => {
    vi.useFakeTimers()
    const refresh = vi.fn()
    const stop = watchTrafficObservationChanges(refresh)
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })

    window.dispatchEvent(new Event(TRAFFIC_OBSERVATION_SAVED_EVENT))
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(30_000)
    expect(refresh).not.toHaveBeenCalled()

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(refresh).toHaveBeenCalledOnce()
    stop()
  })
})
