import type { CctvLocation } from '../domain/cctv'
import type { TrafficObservation } from '../domain/traffic'

export interface CctvDataSource {
  listLocations(): Promise<readonly CctvLocation[]>
}

export interface TrafficObservationDataSource {
  listRecentObservations(): Promise<readonly TrafficObservation[]>
}
