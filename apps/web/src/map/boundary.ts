export interface BoundaryProperties {
  Kabupaten?: string
  KECAMATAN: string
  Luas?: number | string
  kec?: string
  [key: string]: unknown
}

interface BoundaryGeometry {
  type: 'Polygon' | 'MultiPolygon'
  coordinates: number[][][] | number[][][][]
}

export interface BoundaryFeature {
  type: 'Feature'
  properties: BoundaryProperties
  geometry: BoundaryGeometry
}

export interface BoundaryFeatureCollection {
  type: 'FeatureCollection'
  features: BoundaryFeature[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isBoundaryFeature(value: unknown): value is BoundaryFeature {
  if (!isRecord(value) || value.type !== 'Feature') return false
  if (!isRecord(value.properties) || typeof value.properties.KECAMATAN !== 'string') return false
  if (!isRecord(value.geometry)) return false

  return (
    (value.geometry.type === 'Polygon' || value.geometry.type === 'MultiPolygon') &&
    Array.isArray(value.geometry.coordinates)
  )
}

export function isBoundaryFeatureCollection(value: unknown): value is BoundaryFeatureCollection {
  return (
    isRecord(value) &&
    value.type === 'FeatureCollection' &&
    Array.isArray(value.features) &&
    value.features.length > 0 &&
    value.features.every(isBoundaryFeature)
  )
}

export async function loadBoundary(url: string): Promise<BoundaryFeatureCollection> {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Boundary request failed with HTTP ${response.status}.`)
  }

  const data: unknown = await response.json()

  if (!isBoundaryFeatureCollection(data)) {
    throw new Error('Boundary data is not a valid Banda Aceh feature collection.')
  }

  return data
}

export function districtAreaLabel(value: unknown): string {
  const area = typeof value === 'string' ? Number.parseFloat(value) : value
  return typeof area === 'number' && Number.isFinite(area) ? `${area.toLocaleString()} ha` : 'Not recorded'
}
