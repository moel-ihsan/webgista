export const DEFAULT_MAP_CENTER = [95.32780088750104, 5.5528745289364];
export const DEFAULT_MAP_ZOOM = 13;

export const MAPBOX_STYLES = [
  { id: "streets-v11", label: "Street" },
  { id: "light-v10", label: "Light" },
  { id: "dark-v10", label: "Dark" },
  { id: "outdoors-v11", label: "Outdoor" }
];

/**
 * Resolve the Mapbox GL JS access token at runtime from the Blade meta tag.
 *
 * @returns {string}
 */
export function getMapboxAccessToken() {
  if (typeof document !== "undefined") {
    const meta = document.querySelector('meta[name="mapbox-token"]');
    if (meta && meta.content) {
      return meta.content.trim();
    }
  }

  return "";
}

/**
 * Build a Mapbox style URL from a style slug.
 *
 * @param {string} styleId
 * @returns {string}
 */
export function getMapboxStyleUrl(styleId = "streets-v11") {
  return `mapbox://styles/mapbox/${styleId}`;
}
