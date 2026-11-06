import type { CctvLocation } from '../domain/cctv'
import type { TrafficDemoVideo } from '../data/trafficDemo'

export interface CctvFeatureProperties {
  cctvId: string
  name: string
  category: 'Regular' | 'Analytic'
  condition: 'great' | 'good' | 'average' | 'poor' | 'bad' | 'terrible' | 'No Data'
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
        condition: location.trafficCondition ?? 'No Data',
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
  const details = [
    { label: 'Address', value: location.address || 'Not recorded' },
    { label: 'Agency', value: location.agency.name || 'Not recorded' },
    { label: 'Category', value: location.category === 'analytic' ? 'Analytic' : 'Regular' },
    { label: 'Traffic condition', value: location.trafficCondition ? conditionLabel(location.trafficCondition) : 'No Data' },
    { label: 'Video', value: 'No authorized video is attached' },
  ]
  if (location.trafficConditionSource) details.splice(4, 0, {
    label: 'Condition source',
    value: location.trafficConditionSource === 'manual' ? 'Manual observation'
      : location.trafficConditionSource === 'experimental_v1_estimate' ? 'Experimental V1-style estimate — demo video'
        : 'Traffic observation',
  })
  return details
}

function conditionLabel(condition: NonNullable<CctvLocation['trafficCondition']>): string {
  return condition.charAt(0).toUpperCase() + condition.slice(1)
}

export function createCctvPopupContent(location: CctvLocation): HTMLElement {
  const content = document.createElement('section')
  content.className = 'cctv-map-popup'
  const title = document.createElement('h2')
  title.textContent = location.name
  content.append(title)

  const media = document.createElement('div')
  media.className = 'cctv-map-popup__media'
  if (location.snapshotUrl) {
    const image = document.createElement('img')
    image.className = 'cctv-map-popup__image'
    image.src = location.snapshotUrl
    image.alt = `${location.name} camera image`
    image.loading = 'lazy'
    media.append(image)
  } else {
    const unavailable = document.createElement('p')
    unavailable.className = 'cctv-map-popup__media-note'
    unavailable.textContent = location.category === 'analytic' ? 'Video unavailable in this release.' : 'Camera image unavailable.'
    media.append(unavailable)
  }
  content.append(media)

  for (const detail of cctvPopupDetails(location)) {
    const row = document.createElement('p')
    const label = document.createElement('strong')
    label.textContent = `${detail.label}: `
    const value = document.createElement('span')
    value.textContent = detail.value
    row.append(label, value)
    content.append(row)
  }
  const view = document.createElement('a')
  view.className = 'cctv-map-popup__view'
  view.href = `/cctv/${encodeURIComponent(location.id)}`
  view.textContent = 'View CCTV'
  content.append(view)
  return content
}

function setPopupVideoStatus(content: HTMLElement, value: string): void {
  const row = [...content.querySelectorAll('p')].find((item) => item.querySelector('strong')?.textContent === 'Video: ')
  const detail = row?.querySelector('span')
  if (detail) detail.textContent = value
}

export function mountPopupDemoVideo(content: HTMLElement, location: CctvLocation, demo: TrafficDemoVideo): () => void {
  const media = content.querySelector('.cctv-map-popup__media')
  if (!media) return () => undefined

  const video = document.createElement('video')
  video.className = 'cctv-map-popup__video'
  video.src = demo.previewVideoUrl
  video.poster = location.snapshotUrl ?? ''
  video.autoplay = true
  video.muted = true
  video.loop = true
  video.playsInline = true
  video.preload = 'none'
  video.setAttribute('aria-label', `DEMO VIDEO — NOT LIVE CCTV: ${demo.title}`)
  media.replaceChildren(video)
  setPopupVideoStatus(content, `Demo video: ${demo.title}`)

  const label = document.createElement('p')
  label.className = 'cctv-map-popup__demo-label'
  label.append(document.createTextNode('DEMO VIDEO — NOT LIVE CCTV · '))
  const source = document.createElement('a')
  source.href = demo.sourceUrl
  source.target = '_blank'
  source.rel = 'noreferrer'
  source.textContent = `${demo.creator} / Pexels`
  label.append(source)
  media.append(label)

  const showFallback = () => {
    setPopupVideoStatus(content, 'Demo video unavailable')
    video.pause()
    video.removeAttribute('src')
    video.load()
    if (location.snapshotUrl) {
      const image = document.createElement('img')
      image.className = 'cctv-map-popup__image'
      image.src = location.snapshotUrl
      image.alt = `${location.name} camera image`
      media.replaceChildren(image)
    } else {
      const message = document.createElement('p')
      message.className = 'cctv-map-popup__media-note'
      message.textContent = 'Demo video unavailable. Camera image unavailable.'
      media.replaceChildren(message)
    }
  }
  video.addEventListener('error', showFallback, { once: true })

  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  if (saveData || reducedMotion) {
    video.autoplay = false
    video.preload = 'none'
    video.removeAttribute('src')
    const play = document.createElement('button')
    play.type = 'button'
    play.className = 'cctv-map-popup__play'
    play.textContent = 'Play demo video'
    play.addEventListener('click', () => {
      video.src = demo.previewVideoUrl
      video.load()
      void video.play().then(() => play.remove()).catch(() => { play.textContent = 'Video playback unavailable' })
    }, { once: true })
    media.append(play)
  } else {
    void video.play().catch(() => {
      const play = document.createElement('button')
      play.type = 'button'
      play.className = 'cctv-map-popup__play'
      play.textContent = 'Play demo video'
      play.addEventListener('click', () => {
        void video.play().then(() => play.remove()).catch(() => { play.textContent = 'Video playback unavailable' })
      }, { once: true })
      media.append(play)
    })
  }

  return () => {
    video.removeEventListener('error', showFallback)
    video.pause()
    video.removeAttribute('src')
    video.load()
  }
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
