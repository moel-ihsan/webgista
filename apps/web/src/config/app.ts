export const mapStyles = [
  { id: 'street', label: 'Street', url: 'https://tiles.openfreemap.org/styles/liberty' },
  { id: 'light', label: 'Light', url: 'https://tiles.openfreemap.org/styles/positron' },
  { id: 'dark', label: 'Dark', url: 'https://tiles.openfreemap.org/styles/dark' },
  { id: 'outdoor', label: 'Outdoor', url: 'https://tiles.openfreemap.org/styles/bright' },
] as const

export type MapStyleId = (typeof mapStyles)[number]['id']
export const defaultMapStyleId: MapStyleId = 'street'

export const appConfig = Object.freeze({
  name: 'WebGISTA',
  versionLabel: 'v2 · Phase 2B',
  privateMediaEnabled: import.meta.env.VITE_SUPABASE_PRIVATE_MEDIA_ENABLED === 'true',
  profileFieldsEnabled: import.meta.env.VITE_SUPABASE_PROFILE_FIELDS_ENABLED === 'true',
  roiDensityEnabled: import.meta.env.VITE_SUPABASE_ROI_DENSITY_ENABLED === 'true',
  roiAnalysisEnabled: import.meta.env.VITE_SUPABASE_ROI_ANALYSIS_ENABLED === 'true',
  agencyRemovalEnabled: import.meta.env.VITE_AGENCY_REMOVAL_ENABLED === 'true',
  map: {
    styles: mapStyles,
    defaultStyleId: defaultMapStyleId,
    center: [95.3238, 5.5483] as [number, number],
    zoom: 11.2,
    boundaryUrl: `${import.meta.env.BASE_URL}data/banda-aceh.geojson`,
  },
})
