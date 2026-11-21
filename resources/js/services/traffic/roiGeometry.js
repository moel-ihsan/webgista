export const MIN_ROI_POINTS = 3;
const LEGACY_ROI_INDICES = [1, 2, 3, 4, 5];

/**
 * Normalize an arbitrary array of coordinate objects into valid non-negative `{ x, y }` vertices.
 *
 * @param {unknown} rawPoints
 * @returns {Array<{ x: number, y: number }>}
 */
function normalizePoints(rawPoints) {
  if (!Array.isArray(rawPoints)) {
    return [];
  }

  const points = [];
  for (const pt of rawPoints) {
    if (!pt || typeof pt !== "object") {
      return [];
    }
    const rawX = pt.x;
    const rawY = pt.y;
    if (
      rawX === null ||
      rawX === undefined ||
      rawX === "" ||
      rawY === null ||
      rawY === undefined ||
      rawY === ""
    ) {
      return [];
    }

    const x = Number(rawX);
    const y = Number(rawY);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0) {
      return [];
    }

    points.push({ x, y });
  }

  return points;
}

/**
 * Extract ROI polygon vertices from a CCTV record (`roi_polygon` or legacy `rec1x`..`rec5y`).
 *
 * @param {Record<string, unknown> | Array<{ x: number, y: number }> | null | undefined} cctv
 * @returns {Array<{ x: number, y: number }>}
 */
export function extractRoiPoints(cctv) {
  if (Array.isArray(cctv)) {
    const direct = normalizePoints(cctv);
    return isValidRoi(direct) ? direct : [];
  }

  if (!cctv || typeof cctv !== "object") {
    return [];
  }

  if (Array.isArray(cctv.roi_polygon)) {
    const polygonPoints = normalizePoints(cctv.roi_polygon);
    if (isValidRoi(polygonPoints)) {
      return polygonPoints;
    }
  }

  const legacyPoints = [];
  for (const idx of LEGACY_ROI_INDICES) {
    const rawX = cctv[`rec${idx}x`];
    const rawY = cctv[`rec${idx}y`];

    if (
      rawX === null ||
      rawX === undefined ||
      rawX === "" ||
      rawY === null ||
      rawY === undefined ||
      rawY === ""
    ) {
      return [];
    }

    const x = Number(rawX);
    const y = Number(rawY);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0) {
      return [];
    }

    legacyPoints.push({ x, y });
  }

  return isValidRoi(legacyPoints) ? legacyPoints : [];
}

/**
 * Compute polygon area via the shoelace formula.
 *
 * @param {Array<{ x: number, y: number }>} points
 * @returns {number}
 */
export function polygonArea(points) {
  if (!Array.isArray(points) || points.length < 3) {
    return 0;
  }

  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    sum += current.x * next.y - next.x * current.y;
  }

  return Math.abs(sum) / 2;
}

/**
 * Validate that an ROI consists of at least 3 non-negative numeric vertices forming a non-zero area.
 *
 * @param {Array<{ x: number, y: number }>} points
 * @returns {boolean}
 */
export function isValidRoi(points) {
  if (!Array.isArray(points) || points.length < MIN_ROI_POINTS) {
    return false;
  }

  const normalized = normalizePoints(points);
  if (normalized.length !== points.length) {
    return false;
  }

  return polygonArea(normalized) > 0;
}

/**
 * Serialize N >= 3 polygon vertices into the backend payload (`{ points: [...] }`).
 *
 * @param {Array<{ x: number, y: number }>} points
 * @returns {{ points: Array<{ x: number, y: number }> }}
 */
export function serializeRoiPoints(points) {
  if (!isValidRoi(points)) {
    throw new Error("ROI requires at least 3 valid points forming a non-zero area");
  }

  return {
    points: points.map((pt) => ({
      x: Math.round(Number(pt.x) * 100) / 100,
      y: Math.round(Number(pt.y) * 100) / 100
    }))
  };
}

/**
 * Trace and optionally clip or stroke the ROI polygon onto a 2D canvas context.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{ x: number, y: number }>} points
 * @param {{ strokeStyle?: string, lineWidth?: number, clip?: boolean }} options
 */
export function drawRoiPolygon(
  ctx,
  points,
  { strokeStyle = "blue", lineWidth = 5, clip = false } = {}
) {
  if (!ctx || !isValidRoi(points)) {
    return false;
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.lineTo(points[0].x, points[0].y);
  ctx.closePath();

  if (clip) {
    ctx.clip();
    return true;
  }

  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = strokeStyle;
  ctx.stroke();

  return true;
}

/**
 * Determine whether a 2D point lies inside a polygon using ray casting.
 *
 * @param {{ x: number, y: number }} point
 * @param {Array<{ x: number, y: number }>} polygon
 * @returns {boolean}
 */
export function isPointInPolygon(point, polygon) {
  if (!point || !Array.isArray(polygon) || polygon.length < 3) {
    return false;
  }

  const px = Number(point.x);
  const py = Number(point.y);
  if (!Number.isFinite(px) || !Number.isFinite(py)) {
    return false;
  }

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = Number(polygon[i].x);
    const yi = Number(polygon[i].y);
    const xj = Number(polygon[j].x);
    const yj = Number(polygon[j].y);

    const intersects = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Keep only detections whose bounding-box center falls inside the ROI polygon.
 * Falls back to returning all detections unchanged when no valid ROI is configured.
 *
 * @param {Array<{ bbox?: number[], class?: string, score?: number }>} detections
 * @param {Array<{ x: number, y: number }>} roiPoints
 * @returns {Array<{ bbox?: number[], class?: string, score?: number }>}
 */
export function filterDetectionsByRoi(detections = [], roiPoints = []) {
  if (!Array.isArray(detections)) {
    return [];
  }

  if (!isValidRoi(roiPoints)) {
    return detections;
  }

  return detections.filter((det) => {
    if (!det || !Array.isArray(det.bbox) || det.bbox.length < 4) {
      return false;
    }
    const [x, y, w, h] = det.bbox;
    const cx = Number(x) + Number(w) / 2;
    const cy = Number(y) + Number(h) / 2;
    return isPointInPolygon({ x: cx, y: cy }, roiPoints);
  });
}

/**
 * Map a pointer event client coordinate onto intrinsic canvas bitmap coordinates,
 * accounting for CSS object-fit sizing (`cover`, `contain`, or `fill`).
 *
 * @param {{ clientX: number, clientY: number, rect: { left: number, top: number, width: number, height: number }, canvasWidth: number, canvasHeight: number, objectFit?: string }} params
 * @returns {{ x: number, y: number }}
 */
export function mapClientPointToCanvas({
  clientX,
  clientY,
  rect,
  canvasWidth,
  canvasHeight,
  objectFit = "fill"
}) {
  const boxW = Number(rect && rect.width) || 1;
  const boxH = Number(rect && rect.height) || 1;
  const left = Number(rect && rect.left) || 0;
  const top = Number(rect && rect.top) || 0;
  const canvasW = Number(canvasWidth) || 1;
  const canvasH = Number(canvasHeight) || 1;

  const relX = Number(clientX) - left;
  const relY = Number(clientY) - top;

  let x;
  let y;

  if (objectFit === "cover" || objectFit === "contain") {
    const scale =
      objectFit === "cover"
        ? Math.max(boxW / canvasW, boxH / canvasH)
        : Math.min(boxW / canvasW, boxH / canvasH);
    const renderedW = canvasW * scale;
    const renderedH = canvasH * scale;
    const offsetX = (boxW - renderedW) / 2;
    const offsetY = (boxH - renderedH) / 2;
    x = (relX - offsetX) / scale;
    y = (relY - offsetY) / scale;
  } else {
    x = (relX / boxW) * canvasW;
    y = (relY / boxH) * canvasH;
  }

  const clampedX = Math.min(canvasW, Math.max(0, x));
  const clampedY = Math.min(canvasH, Math.max(0, y));

  return {
    x: Math.round(clampedX * 100) / 100,
    y: Math.round(clampedY * 100) / 100
  };
}
