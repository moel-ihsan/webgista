import httpClient from "../api/httpClient";
import { filterDetectionsByRoi } from "./roiGeometry";

/**
 * Fetch and validate a precomputed detection timeline JSON payload.
 *
 * @param {string} url
 * @returns {Promise<{ width: number, height: number, duration: number, frames: Array<{ t: number, detections: Array }> }>}
 */
export function fetchPrecomputedDetections(url) {
  if (!url) {
    return Promise.reject(new Error("Precomputed detection URL is missing"));
  }

  return httpClient.get(url).then((res) => {
    const data = res && res.data;
    if (!data || !Array.isArray(data.frames) || data.frames.length === 0) {
      throw new Error("Invalid precomputed detection payload");
    }

    return {
      width: Number(data.width) || 640,
      height: Number(data.height) || 360,
      duration: Number(data.duration) || 30,
      frames: [...data.frames].sort((a, b) => Number(a.t) - Number(b.t))
    };
  });
}

/**
 * Locate the latest recorded frame at or before `currentTime`.
 *
 * @param {Array<{ t: number, detections: Array }>} frames
 * @param {number} currentTime
 * @returns {{ t: number, detections: Array } | null}
 */
export function findFrameAtTime(frames, currentTime = 0) {
  if (!Array.isArray(frames) || frames.length === 0) {
    return null;
  }

  const safeTime = Number.isFinite(currentTime) && currentTime >= 0 ? currentTime : 0;
  let candidate = frames[0];

  for (let i = 0; i < frames.length; i += 1) {
    if (Number(frames[i].t) <= safeTime) {
      candidate = frames[i];
    } else {
      break;
    }
  }

  return candidate;
}

/**
 * Rescale detection bounding boxes from source video coordinates into target canvas coordinates.
 *
 * @param {Array<{ bbox: number[], class: string, score?: number }>} detections
 * @param {{ width: number, height: number }} sourceSize
 * @param {{ width: number, height: number }} targetSize
 * @returns {Array<{ bbox: number[], class: string, score?: number }>}
 */
export function scaleDetections(detections = [], sourceSize = {}, targetSize = {}) {
  if (!Array.isArray(detections)) {
    return [];
  }

  const srcW = Number(sourceSize.width);
  const srcH = Number(sourceSize.height);
  const dstW = Number(targetSize.width) || srcW;
  const dstH = Number(targetSize.height) || srcH;

  if (!srcW || !srcH || (srcW === dstW && srcH === dstH)) {
    return detections.map((det) => ({
      ...det,
      bbox: Array.isArray(det.bbox) ? [...det.bbox] : []
    }));
  }

  const scaleX = dstW / srcW;
  const scaleY = dstH / srcH;

  return detections.map((det) => {
    const [x = 0, y = 0, w = 0, h = 0] = Array.isArray(det.bbox) ? det.bbox : [];
    return {
      ...det,
      bbox: [x * scaleX, y * scaleY, w * scaleX, h * scaleY]
    };
  });
}

/**
 * Retrieve synchronized, scaled, and ROI-filtered detections for the given video timestamp.
 *
 * @param {{ width?: number, height?: number, frames?: Array } | null | undefined} payload
 * @param {number} currentTime
 * @param {{ width?: number, height?: number }} targetSize
 * @param {Array<{ x: number, y: number }>} roiPoints
 * @returns {{ frameTime: number | null, detections: Array }}
 */
export function getSynchronizedDetections(payload, currentTime, targetSize = {}, roiPoints = []) {
  if (!payload || !Array.isArray(payload.frames) || payload.frames.length === 0) {
    return { frameTime: null, detections: [] };
  }

  const frame = findFrameAtTime(payload.frames, currentTime);
  if (!frame) {
    return { frameTime: null, detections: [] };
  }

  const scaled = scaleDetections(
    frame.detections || [],
    { width: payload.width, height: payload.height },
    targetSize
  );

  return {
    frameTime: Number(frame.t),
    detections: filterDetectionsByRoi(scaled, roiPoints)
  };
}
