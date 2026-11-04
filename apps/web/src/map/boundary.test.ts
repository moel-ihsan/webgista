import { afterEach, describe, expect, it, vi } from 'vitest'

import boundaryAsset from '../../public/data/banda-aceh.geojson?raw'
import { districtAreaLabel, districtDetails, isBoundaryFeatureCollection, isWithinBoundary, loadBoundary } from './boundary'

const ring = [
  [95.3, 5.5],
  [95.4, 5.5],
  [95.4, 5.6],
  [95.3, 5.5],
]

const validBoundary = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { KECAMATAN: 'Kuta Alam', Luas: 1_234.5 },
      geometry: {
        type: 'MultiPolygon',
        coordinates: [[[...ring]]],
      },
    },
  ],
}

describe('Banda Aceh boundary validation', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('accepts the expected feature collection shape', () => {
    expect(isBoundaryFeatureCollection(validBoundary)).toBe(true)
  })

  it('validates the preserved Banda Aceh dataset and its nine unique district names', () => {
    const actualBoundary: unknown = JSON.parse(boundaryAsset)
    expect(isBoundaryFeatureCollection(actualBoundary)).toBe(true)
    if (!isBoundaryFeatureCollection(actualBoundary)) return

    expect(actualBoundary.features).toHaveLength(9)
    expect(actualBoundary.features.every((feature) => feature.geometry.type === 'MultiPolygon')).toBe(true)
    expect(new Set(actualBoundary.features.map((feature) => feature.properties.KECAMATAN)).size).toBe(9)
    expect(actualBoundary.features.every((feature) => typeof feature.properties.Luas === 'number')).toBe(true)
  })

  it('checks points against the preserved district polygons for form warnings', () => {
    const actualBoundary: unknown = JSON.parse(boundaryAsset)
    if (!isBoundaryFeatureCollection(actualBoundary)) throw new Error('Bundled boundary fixture is invalid')
    expect(isWithinBoundary(actualBoundary, 95.3238, 5.5483)).toBe(true)
    expect(isWithinBoundary(actualBoundary, 95, 5.5)).toBe(false)
  })

  it('rejects data without a district name', () => {
    expect(
      isBoundaryFeatureCollection({
        ...validBoundary,
        features: [{ ...validBoundary.features[0], properties: {} }],
      }),
    ).toBe(false)
  })

  it('rejects invalid geographic coordinates and unclosed polygon rings', () => {
    expect(
      isBoundaryFeatureCollection({
        ...validBoundary,
        features: [{
          ...validBoundary.features[0],
          geometry: { type: 'Polygon', coordinates: [[[181, 5], [181, 6], [180, 6], [181, 5]]] },
        }],
      }),
    ).toBe(false)
    expect(
      isBoundaryFeatureCollection({
        ...validBoundary,
        features: [{
          ...validBoundary.features[0],
          geometry: { type: 'Polygon', coordinates: [[[95.3, 5.5], [95.4, 5.5], [95.4, 5.6], [95.3, 5.6]]] },
        }],
      }),
    ).toBe(false)
  })

  it('formats numeric area values without inventing missing values', () => {
    expect(districtAreaLabel(1234.5)).toBe('1,234.5 ha')
    expect(districtAreaLabel(undefined)).toBe('Not recorded')
  })

  it('reads district details from actual property names and handles optional area', () => {
    expect(districtDetails({ KECAMATAN: 'Kecamatan Kuta Alam', Luas: 1234.5 })).toEqual({
      name: 'Kecamatan Kuta Alam',
      area: '1,234.5 ha',
    })
    expect(districtDetails({ KECAMATAN: 'Kecamatan Kuta Alam' })).toEqual({
      name: 'Kecamatan Kuta Alam',
      area: 'Not recorded',
    })
    expect(districtDetails({ KECAMATAN: '' })).toBeNull()
  })

  it('reports a missing geographic resource without treating it as a basemap error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))

    await expect(loadBoundary('/data/banda-aceh.geojson')).rejects.toThrow(
      'Boundary request failed with HTTP 503.',
    )
  })
})
