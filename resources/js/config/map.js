export const DEFAULT_MAP_CENTER = [95.32780088750104, 5.5528745289364];
export const DEFAULT_MAP_ZOOM = 13;

export const MAP_STYLES = [
  { id: "streets", label: "Street" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "outdoor", label: "Outdoor" }
];

export const OPENFREEMAP_GLYPHS_URL = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";

export const CLUSTER_TEXT_FONT = ["Noto Sans Bold"];

const STYLE_ALIASES = {
  "streets-v11": "streets",
  streets: "streets",
  street: "streets",
  "light-v10": "light",
  light: "light",
  "dark-v10": "dark",
  dark: "dark",
  "outdoors-v11": "outdoor",
  outdoors: "outdoor",
  outdoor: "outdoor"
};

const DEFAULT_MAP_CONFIG = {
  provider: "auto",
  maptiler_key: "",
  stadia_key: ""
};

/**
 * Normalize legacy v1 style IDs (e.g. streets-v11) to canonical style keys.
 *
 * @param {string} styleId
 * @returns {"streets" | "light" | "dark" | "outdoor"}
 */
export function normalizeStyleId(styleId = "streets") {
  const key = typeof styleId === "string" ? styleId.trim().toLowerCase() : "streets";
  return STYLE_ALIASES[key] || "streets";
}

/**
 * Read non-secret map provider settings embedded in `<meta name="map-config">`.
 *
 * @returns {{ provider: string, maptiler_key: string, stadia_key: string }}
 */
export function getMapConfig() {
  if (typeof document === "undefined") {
    return { ...DEFAULT_MAP_CONFIG };
  }

  const meta = document.querySelector('meta[name="map-config"]');
  if (!meta || !meta.content) {
    return { ...DEFAULT_MAP_CONFIG };
  }

  try {
    const parsed = JSON.parse(meta.content);
    if (!parsed || typeof parsed !== "object") {
      return { ...DEFAULT_MAP_CONFIG };
    }

    return {
      provider:
        typeof parsed.provider === "string" && parsed.provider.trim()
          ? parsed.provider.trim().toLowerCase()
          : "auto",
      maptiler_key: typeof parsed.maptiler_key === "string" ? parsed.maptiler_key.trim() : "",
      stadia_key: typeof parsed.stadia_key === "string" ? parsed.stadia_key.trim() : ""
    };
  } catch (_err) {
    return { ...DEFAULT_MAP_CONFIG };
  }
}

/**
 * Determine which basemap provider to activate based on configured keys and explicit preference.
 *
 * @param {{ provider?: string, maptiler_key?: string, stadia_key?: string }} config
 * @returns {"openfreemap" | "maptiler" | "stadia"}
 */
export function resolveMapProvider(config = getMapConfig()) {
  const provider = (config && config.provider ? String(config.provider) : "auto").toLowerCase();
  const hasMaptiler = Boolean(config && config.maptiler_key);
  const hasStadia = Boolean(config && config.stadia_key);

  if (provider === "maptiler" && hasMaptiler) {
    return "maptiler";
  }

  if (provider === "stadia" && hasStadia) {
    return "stadia";
  }

  if (provider === "openfreemap") {
    return "openfreemap";
  }

  if (hasMaptiler) {
    return "maptiler";
  }

  if (hasStadia) {
    return "stadia";
  }

  return "openfreemap";
}

/**
 * Build an inline MapLibre Style Spec v8 raster style backed by OpenTopoMap for the Outdoor preset.
 *
 * @returns {Record<string, any>}
 */
export function buildOutdoorRasterStyle() {
  return {
    version: 8,
    name: "Outdoor (OpenTopoMap)",
    glyphs: OPENFREEMAP_GLYPHS_URL,
    sources: {
      opentopomap: {
        type: "raster",
        tiles: [
          "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
          "https://b.tile.opentopomap.org/{z}/{x}/{y}.png",
          "https://c.tile.opentopomap.org/{z}/{x}/{y}.png"
        ],
        tileSize: 256,
        maxzoom: 17,
        attribution:
          'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
      }
    },
    layers: [
      {
        id: "opentopomap-layer",
        type: "raster",
        source: "opentopomap",
        minzoom: 0,
        maxzoom: 19
      }
    ]
  };
}

/**
 * Resolve a MapLibre style URL or inline Style Specification object for the given preset ID.
 *
 * @param {string} styleId
 * @param {{ provider?: string, maptiler_key?: string, stadia_key?: string }} config
 * @returns {string | Record<string, any>}
 */
export function getMapStyle(styleId = "streets", config = getMapConfig()) {
  const normalized = normalizeStyleId(styleId);
  const provider = resolveMapProvider(config);

  if (provider === "maptiler") {
    const maptilerStyles = {
      streets: "streets-v2",
      light: "streets-v2-light",
      dark: "streets-v2-dark",
      outdoor: "outdoor-v2"
    };
    const key = encodeURIComponent(config.maptiler_key);
    return `https://api.maptiler.com/maps/${maptilerStyles[normalized]}/style.json?key=${key}`;
  }

  if (provider === "stadia") {
    const stadiaStyles = {
      streets: "alidade_bright",
      light: "alidade_smooth",
      dark: "alidade_smooth_dark",
      outdoor: "outdoors"
    };
    const key = encodeURIComponent(config.stadia_key);
    return `https://tiles.stadiamaps.com/styles/${stadiaStyles[normalized]}.json?api_key=${key}`;
  }

  if (normalized === "outdoor") {
    return buildOutdoorRasterStyle();
  }

  const openFreeMapStyles = {
    streets: "liberty",
    light: "positron",
    dark: "dark"
  };

  return `https://tiles.openfreemap.org/styles/${openFreeMapStyles[normalized]}`;
}
