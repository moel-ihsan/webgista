/**
 * Format a numeric coordinate value to 6 decimal places.
 *
 * @param {number | string} value
 * @returns {string}
 */
export function formatCoordinate(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed.toFixed(6) : "0.000000";
}

/**
 * Resolve a CCTV thumbnail path to `/storage/...` or `/assets/...`.
 *
 * @param {string | null | undefined} pathImage
 * @returns {string}
 */
export function resolveCctvImagePath(pathImage) {
  if (!pathImage) {
    return "/assets/tf1.jpg";
  }

  if (
    pathImage.startsWith("/") ||
    pathImage.startsWith("http") ||
    pathImage.startsWith("data:") ||
    pathImage.startsWith("blob:")
  ) {
    return pathImage;
  }

  return pathImage.includes("/") ? `/storage/${pathImage}` : `/assets/${pathImage}`;
}

/**
 * Resolve a user/office profile avatar path.
 *
 * @param {string | null | undefined} pathImage
 * @returns {string}
 */
export function resolveProfileImagePath(pathImage) {
  if (!pathImage) {
    return "/assets/tf5.jpg";
  }

  if (
    pathImage.startsWith("/") ||
    pathImage.startsWith("http") ||
    pathImage.startsWith("data:") ||
    pathImage.startsWith("blob:")
  ) {
    return pathImage;
  }

  return `/storage/${pathImage}`;
}

/**
 * Escape HTML special characters before embedding dynamic values into MapLibre popup markup.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
