import { TRAFFIC_OBSERVATION_SAVED_EVENT } from './trafficObservations'
import type { TrafficObservation } from '../domain/traffic'
import type { CctvLocation } from '../domain/cctv'

const REFRESH_INTERVAL_MS = 30_000

export function mergeLatestTrafficConditions(
  locations: readonly CctvLocation[],
  snapshots: ReadonlyMap<string, { condition: TrafficObservation['condition']; source: CctvLocation['trafficConditionSource'] }>,
): { locations: readonly CctvLocation[]; changed: boolean } {
  let changed = false
  const updated = locations.map((location) => {
    const snapshot = snapshots.get(location.id)
    const condition = snapshot?.condition ?? null
    const source = snapshot?.source ?? null
    if ((location.trafficCondition ?? null) === condition && (location.trafficConditionSource ?? null) === source) return location
    changed = true
    return { ...location, trafficCondition: condition, trafficConditionSource: source }
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
