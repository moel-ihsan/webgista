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
    { label: 'Video', value: 'Secure video access is not configured' },
  ]
}

export function createCctvPopupContent(location: CctvLocation): HTMLElement {
  const content = document.createElement('section')
  content.className = 'cctv-map-popup'
  const title = document.createElement('h2')
  title.textContent = location.name
  content.append(title)

  if (location.snapshotUrl) {
    const image = document.createElement('img')
    image.className = 'cctv-map-popup__image'
    image.src = location.snapshotUrl
    image.alt = `${location.name} camera image`
    image.loading = 'lazy'
    content.append(image)
  } else {
    const unavailable = document.createElement('p')
    unavailable.className = 'cctv-map-popup__media-note'
    unavailable.textContent = location.category === 'analytic' ? 'Video unavailable in this release.' : 'Camera image unavailable.'
    content.append(unavailable)
  }

  for (const detail of cctvPopupDetails(location)) {
    const row = document.createElement('p')
    const label = document.createElement('strong')
    label.textContent = `${detail.label}: `
    const value = document.createElement('span')
    value.textContent = detail.value
    row.append(label, value)
    content.append(row)
  }
  return content
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
