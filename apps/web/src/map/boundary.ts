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

function isPosition(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    value.every((ordinate) => typeof ordinate === 'number' && Number.isFinite(ordinate)) &&
    value[0] >= -180 && value[0] <= 180 &&
    value[1] >= -90 && value[1] <= 90
  )
}

function isLinearRing(value: unknown): boolean {
  if (!Array.isArray(value) || value.length < 4 || !value.every(isPosition)) return false
  const first = value[0]
  const last = value.at(-1)
  if (!first || !last) return false
  return first.length === last.length && first.every((ordinate, index) => ordinate === last[index])
}

function isPolygon(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0 && value.every(isLinearRing)
}

function isGeometry(value: Record<string, unknown>): value is Record<string, unknown> & BoundaryGeometry {
  if (value.type === 'Polygon') return isPolygon(value.coordinates)
  if (value.type === 'MultiPolygon') {
    return Array.isArray(value.coordinates) && value.coordinates.length > 0 && value.coordinates.every(isPolygon)
  }
  return false
}

function isBoundaryFeature(value: unknown): value is BoundaryFeature {
  if (!isRecord(value) || value.type !== 'Feature') return false
  if (!isRecord(value.properties) || typeof value.properties.KECAMATAN !== 'string' || !value.properties.KECAMATAN.trim()) return false
  if (!isRecord(value.geometry) || !isGeometry(value.geometry)) return false

  return true
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

export async function loadBoundary(url: string, signal?: AbortSignal): Promise<BoundaryFeatureCollection> {
  const response = await fetch(url, { signal })

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

export function districtDetails(properties: unknown): { name: string; area: string } | null {
  if (!isRecord(properties) || typeof properties.KECAMATAN !== 'string' || !properties.KECAMATAN.trim()) return null
  return { name: properties.KECAMATAN, area: districtAreaLabel(properties.Luas) }
}

function ringContainsPoint(ring: number[][], longitude: number, latitude: number): boolean {
  let inside = false
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const x1 = ring[index]![0]!
    const y1 = ring[index]![1]!
    const x2 = ring[previous]![0]!
    const y2 = ring[previous]![1]!
    const intersects = (y1 > latitude) !== (y2 > latitude) && longitude < ((x2 - x1) * (latitude - y1)) / (y2 - y1) + x1
    if (intersects) inside = !inside
  }
  return inside
}

export function isWithinBoundary(collection: BoundaryFeatureCollection, longitude: number, latitude: number): boolean {
  return collection.features.some(({ geometry }) => {
    const polygons = geometry.type === 'Polygon'
      ? [geometry.coordinates as number[][][]]
      : geometry.coordinates as number[][][][]
    return polygons.some((rings) => ringContainsPoint(rings[0]!, longitude, latitude) && !rings.slice(1).some((hole) => ringContainsPoint(hole, longitude, latitude)))
  })
}
