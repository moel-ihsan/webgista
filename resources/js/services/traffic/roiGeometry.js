const ROI_INDICES = [1, 2, 3, 4, 5];

/**
 * Extract 5 ROI polygon vertices from a CCTV record (`rec1x`..`rec5y`).
 *
 * @param {Record<string, unknown> | null | undefined} cctv
 * @returns {Array<{ x: number, y: number }>}
 */
export function extractRoiPoints(cctv) {
  if (!cctv || typeof cctv !== "object") {
    return [];
  }

  const points = [];
  for (const idx of ROI_INDICES) {
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

    points.push({ x, y });
  }

  return isValidRoi(points) ? points : [];
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
 * Validate that an ROI consists of 5 non-negative numeric vertices forming a non-zero area.
 *
 * @param {Array<{ x: number, y: number }>} points
 * @returns {boolean}
 */
export function isValidRoi(points) {
  if (!Array.isArray(points) || points.length !== 5) {
    return false;
  }

  const allCoordsValid = points.every(
    (pt) =>
      pt &&
      typeof pt === "object" &&
      Number.isFinite(Number(pt.x)) &&
      Number.isFinite(Number(pt.y)) &&
      Number(pt.x) >= 0 &&
      Number(pt.y) >= 0
  );

  if (!allCoordsValid) {
    return false;
  }

  return polygonArea(points) > 0;
}

/**
 * Serialize 5 polygon vertices into the backend column payload (`rec1x`..`rec5y`).
 *
 * @param {Array<{ x: number, y: number }>} points
 * @returns {Record<string, number>}
 */
export function serializeRoiPoints(points) {
  if (!isValidRoi(points)) {
    throw new Error("ROI requires 5 valid points forming a non-zero area");
  }

  const payload = {};
  ROI_INDICES.forEach((idx, arrayIndex) => {
    payload[`rec${idx}x`] = Math.round(Number(points[arrayIndex].x) * 100) / 100;
    payload[`rec${idx}y`] = Math.round(Number(points[arrayIndex].y) * 100) / 100;
  });

  return payload;
}

/**
 * Trace and optionally clip or stroke the 5-point ROI polygon onto a 2D canvas context.
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
