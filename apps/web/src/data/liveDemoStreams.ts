import type { CctvLocation } from '../domain/cctv'

export interface LiveDemoStream {
  cameraId: string
  videoId: string
  title: string
  city: string
  sourceUrl: string
  embedUrl: string
}

const streams: readonly LiveDemoStream[] = [
  {
    cameraId: 'a60eb814-12dc-42df-b1f8-14234631dbeb',
    videoId: 'UTR-nG4SK7E',
    title: 'Simpang Karang Tunggal (Kol. Sugiyono) V. Timur',
    city: 'Yogyakarta',
    sourceUrl: 'https://www.youtube.com/watch?v=UTR-nG4SK7E',
    embedUrl: 'https://www.youtube-nocookie.com/embed/UTR-nG4SK7E?autoplay=1&mute=1&playsinline=1&controls=1',
  },
  {
    cameraId: 'dec221d0-87ae-4194-a3ab-bf60eb4d041f',
    videoId: 'BdPvBNLy5kc',
    title: 'Simpang Jogokariyan V. Selatan',
    city: 'Yogyakarta',
    sourceUrl: 'https://www.youtube.com/watch?v=BdPvBNLy5kc',
    embedUrl: 'https://www.youtube-nocookie.com/embed/BdPvBNLy5kc?autoplay=1&mute=1&playsinline=1&controls=1',
  },
]

export function liveDemoStreamForCamera(cameraId: string): LiveDemoStream | null {
  return streams.find((stream) => stream.cameraId === cameraId) ?? null
}

export function enforceLiveDemoNoData(location: CctvLocation): CctvLocation {
  return liveDemoStreamForCamera(location.id)
    ? { ...location, trafficCondition: null, trafficConditionSource: 'live_demo_unanalyzed' }
    : location
}
