import { latestTrafficConditions, TRAFFIC_OBSERVATION_SAVED_EVENT } from './trafficObservations'
import type { TrafficObservation } from '../domain/traffic'
import type { CctvLocation } from '../domain/cctv'

const REFRESH_INTERVAL_MS = 30_000

export function mergeLatestTrafficConditions(
  locations: readonly CctvLocation[],
  observations: readonly TrafficObservation[],
): { locations: readonly CctvLocation[]; changed: boolean } {
  const conditions = latestTrafficConditions(observations)
  let changed = false
  const updated = locations.map((location) => {
    const condition = conditions.get(location.id) ?? null
    if ((location.trafficCondition ?? null) === condition) return location
    changed = true
    return { ...location, trafficCondition: condition }
  })
  return { locations: changed ? updated : locations, changed }
}

export function watchTrafficObservationChanges(refresh: () => void): () => void {
  const refreshWhenVisible = () => {
    if (document.visibilityState === 'visible') refresh()
  }

  const timer = window.setInterval(refreshWhenVisible, REFRESH_INTERVAL_MS)
  window.addEventListener(TRAFFIC_OBSERVATION_SAVED_EVENT, refreshWhenVisible)
  document.addEventListener('visibilitychange', refreshWhenVisible)

  return () => {
    window.clearInterval(timer)
    window.removeEventListener(TRAFFIC_OBSERVATION_SAVED_EVENT, refreshWhenVisible)
    document.removeEventListener('visibilitychange', refreshWhenVisible)
  }
}
