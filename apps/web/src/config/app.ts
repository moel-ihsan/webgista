const defaultMapStyleUrl = 'https://tiles.openfreemap.org/styles/liberty'

const configuredMapStyleUrl = import.meta.env.VITE_MAP_STYLE_URL?.trim()

export const appConfig = Object.freeze({
  name: 'WebGISTA',
  versionLabel: 'v2 foundation',
  map: {
    styleUrl: configuredMapStyleUrl || defaultMapStyleUrl,
    usesDefaultStyle: !configuredMapStyleUrl,
    center: [95.3238, 5.5483] as [number, number],
    zoom: 11.2,
    boundaryUrl: `${import.meta.env.BASE_URL}data/banda-aceh.geojson`,
  },
})
