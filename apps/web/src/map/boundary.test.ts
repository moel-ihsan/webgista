import { describe, expect, it } from 'vitest'

import { districtAreaLabel, isBoundaryFeatureCollection } from './boundary'

const validBoundary = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { KECAMATAN: 'Kuta Alam', Luas: 1_234.5 },
      geometry: {
        type: 'MultiPolygon',
        coordinates: [[[[95.3, 5.5]]]],
      },
    },
  ],
}

describe('Banda Aceh boundary validation', () => {
  it('accepts the expected feature collection shape', () => {
    expect(isBoundaryFeatureCollection(validBoundary)).toBe(true)
  })

  it('rejects data without a district name', () => {
    expect(
      isBoundaryFeatureCollection({
        ...validBoundary,
        features: [{ ...validBoundary.features[0], properties: {} }],
      }),
    ).toBe(false)
  })

  it('formats numeric area values without inventing missing values', () => {
    expect(districtAreaLabel(1234.5)).toBe('1,234.5 ha')
    expect(districtAreaLabel(undefined)).toBe('Not recorded')
  })
})
