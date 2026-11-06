import { describe, expect, it } from 'vitest'

import { enforceLiveDemoNoData, liveDemoStreamForCamera } from './liveDemoStreams'

const camera = {
  id: 'dec221d0-87ae-4194-a3ab-bf60eb4d041f', legacyId: null, agency: { id: 'a', name: 'Agency' },
  name: 'Demo CCTV', address: 'Banda Aceh', category: 'analytic' as const, longitude: 95, latitude: 5,
  snapshotUrl: null, publicStreamUrl: null, isActive: true,
}

describe('fixed public live demo streams', () => {
  it('maps the requested streams only to their two QA cameras', () => {
    expect(liveDemoStreamForCamera('a60eb814-12dc-42df-b1f8-14234631dbeb')).toMatchObject({
      videoId: 'UTR-nG4SK7E',
      embedUrl: 'https://www.youtube-nocookie.com/embed/UTR-nG4SK7E?autoplay=1&mute=1&playsinline=1&controls=1',
      city: 'Yogyakarta',
    })
    expect(liveDemoStreamForCamera('dec221d0-87ae-4194-a3ab-bf60eb4d041f')?.videoId).toBe('BdPvBNLy5kc')
    expect(liveDemoStreamForCamera('other-camera')).toBeNull()
  })

  it('forces the mapped demo camera to No Data without changing its stored observation', () => {
    const withManualCondition = { ...camera, trafficCondition: 'terrible' as const, trafficConditionSource: 'manual' as const }
    expect(enforceLiveDemoNoData(withManualCondition)).toEqual({
      id: camera.id,
      legacyId: null,
      agency: camera.agency,
      name: camera.name,
      address: camera.address,
      category: camera.category,
      longitude: camera.longitude,
      latitude: camera.latitude,
      snapshotUrl: null,
      publicStreamUrl: null,
      isActive: true,
      trafficCondition: null,
      trafficConditionSource: 'live_demo_unanalyzed',
    })
    expect(withManualCondition.trafficCondition).toBe('terrible')
    expect(enforceLiveDemoNoData({ ...camera, id: 'other-camera', trafficCondition: 'great' }).trafficCondition).toBe('great')
  })
})
