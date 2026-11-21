const DEFAULT_SIMULATION_CONFIG = {
  enabled: false,
  defaultMode: "live",
  bannerText: "",
  cameras: {}
};

/**
 * Normalize camera names into lowercase hyphenated slugs.
 *
 * @param {string} value
 * @returns {string}
 */
export function normalizeCameraSlug(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Read non-secret simulation config embedded in the Blade `<meta name="webgista-simulation">` tag.
 *
 * @returns {{ enabled: boolean, defaultMode: string, bannerText: string, cameras: Record<string, any> }}
 */
export function getSimulationConfig() {
  if (typeof document === "undefined") {
    return { ...DEFAULT_SIMULATION_CONFIG };
  }

  const meta = document.querySelector('meta[name="webgista-simulation"]');
  if (!meta || !meta.content) {
    return { ...DEFAULT_SIMULATION_CONFIG };
  }

  try {
    const parsed = JSON.parse(meta.content);
    if (!parsed || typeof parsed !== "object") {
      return { ...DEFAULT_SIMULATION_CONFIG };
    }

    return {
      enabled: Boolean(parsed.enabled),
      defaultMode: parsed.default_mode === "precomputed" ? "precomputed" : "live",
      bannerText: typeof parsed.banner_text === "string" ? parsed.banner_text : "",
      cameras: parsed.cameras && typeof parsed.cameras === "object" ? parsed.cameras : {}
    };
  } catch (_err) {
    return { ...DEFAULT_SIMULATION_CONFIG };
  }
}

/**
 * Match a CCTV record against configured simulation cameras by video URL or normalized name.
 *
 * @param {Record<string, any> | null | undefined} cctv
 * @param {ReturnType<typeof getSimulationConfig>} config
 * @returns {{ slug: string, videoUrl: string, precomputedUrl: string, defaultRoi: Record<string, number> | null }}
 */
export function resolveCameraSimulation(cctv, config = getSimulationConfig()) {
  const cameras = (config && config.cameras) || {};
  const entries = Object.entries(cameras);
  const cctvUrl = cctv && typeof cctv.url === "string" ? cctv.url.trim() : "";
  const cctvSlug = normalizeCameraSlug(cctv && cctv.name);

  let matchedEntry = entries.find(([, cam]) => cctvUrl && cam && cam.video_url === cctvUrl);
  if (!matchedEntry && cctvSlug) {
    matchedEntry = entries.find(([slug, cam]) => {
      const camSlug = normalizeCameraSlug((cam && cam.name) || slug);
      return slug === cctvSlug || camSlug === cctvSlug;
    });
  }

  if (!matchedEntry) {
    return {
      slug: "",
      videoUrl: cctvUrl,
      precomputedUrl: "",
      defaultRoi: null
    };
  }

  const [slug, cam] = matchedEntry;
  return {
    slug,
    videoUrl: cctvUrl || (cam && cam.video_url) || "",
    precomputedUrl: (cam && cam.precomputed_url) || "",
    defaultRoi: (cam && cam.default_roi) || null
  };
}
