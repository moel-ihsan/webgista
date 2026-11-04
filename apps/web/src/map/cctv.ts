import type { CctvLocation } from '../domain/cctv'

export interface CctvFeatureProperties {
  cctvId: string
  name: string
  category: 'Regular' | 'Analytic'
  condition: 'No Data'
}

export interface CctvPointFeature {
  type: 'Feature'
  id: string
  properties: CctvFeatureProperties
  geometry: { type: 'Point'; coordinates: [number, number] }
}

export interface CctvFeatureCollection {
  type: 'FeatureCollection'
  features: CctvPointFeature[]
}

export function toCctvFeatureCollection(locations: readonly CctvLocation[]): CctvFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: locations.map((location) => ({
      type: 'Feature',
      id: location.id,
      properties: {
        cctvId: location.id,
        name: location.name,
        category: location.category === 'analytic' ? 'Analytic' : 'Regular',
        condition: 'No Data',
      },
      geometry: { type: 'Point', coordinates: [location.longitude, location.latitude] },
    })),
  }
}

export function searchCctvLocations(
  locations: readonly CctvLocation[],
  query: string,
): readonly CctvLocation[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return locations
  return locations.filter(({ name, address, agency }) =>
    `${name} ${address} ${agency.name}`.toLowerCase().includes(normalized),
  )
}

export function cctvPopupDetails(location: CctvLocation): readonly { label: string; value: string }[] {
  return [
    { label: 'Address', value: location.address || 'Not recorded' },
    { label: 'Agency', value: location.agency.name || 'Not recorded' },
    { label: 'Category', value: location.category === 'analytic' ? 'Analytic' : 'Regular' },
    { label: 'Traffic condition', value: 'No Data' },
    { label: 'Video', value: 'Unavailable in Phase 2C' },
  ]
}

export interface CctvCameraNavigator {
  flyTo(options: {
    center: [number, number]
    zoom: number
    offset: [number, number]
    essential: boolean
  }): void
}

export function focusCctvLocation(
  map: CctvCameraNavigator,
  location: CctvLocation,
  drawerOpen: boolean,
  showPopup: (location: CctvLocation) => void,
): void {
  map.flyTo({
    center: [location.longitude, location.latitude],
    zoom: 16,
    offset: drawerOpen ? [-150, 0] : [0, 0],
    essential: true,
  })
  showPopup(location)
}
