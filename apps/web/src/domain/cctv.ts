export type CctvCategory = 'regular' | 'analytic'

export interface AgencySummary {
  id: string
  name: string
}

export interface CctvLocation {
  id: string
  legacyId: number | null
  agency: AgencySummary
  name: string
  address: string
  category: CctvCategory
  longitude: number
  latitude: number
  snapshotUrl: string | null
  publicStreamUrl: string | null
  isActive: boolean
  trafficCondition?: import('./traffic').TrafficCondition | null
  trafficConditionSource?: 'manual' | 'traffic_observation' | null
}
