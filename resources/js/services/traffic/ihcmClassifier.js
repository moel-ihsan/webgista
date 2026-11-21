export const VEHICLE_CLASSES = {
  HV: ["truck", "bus"],
  LV: ["car"],
  MC: ["person", "motorcycle", "bicycle"]
};

export const PCU_WEIGHTS = {
  LV: 1.0,
  HV: 1.3,
  MC: 0.4
};

export const DEFAULT_CAPACITY_PARAMS = {
  baseCapacity: 1650,
  fcw: 1,
  fcsp: 1,
  fcsf: 1,
  fccs: 0.9,
  lanes: 3
};

export const DEFAULT_CAPACITY_PER_HOUR = 4455;
export const ANALYSIS_WINDOW_SECONDS = 30;

export const TRAFFIC_LEVELS = [
  { grade: "A", label: "Great", color: "#98FB98" },
  { grade: "B", label: "Good", color: "#0B6623" },
  { grade: "C", label: "Average", color: "#FFFF00" },
  { grade: "D", label: "Poor", color: "#D4A328" },
  { grade: "E", label: "Bad", color: "#FF5F00" },
  { grade: "F", label: "Terrible", color: "#FF0000" }
];

export const NO_DATA_LEVEL = {
  grade: null,
  label: "No Data",
  color: "#0000FF"
};

/**
 * Map a COCO-SSD class name into an IHCM vehicle category, or null if ignored.
 *
 * @param {string} className
 * @returns {"HV" | "LV" | "MC" | null}
 */
export function mapCocoClassToCategory(className) {
  if (typeof className !== "string") {
    return null;
  }

  const normalized = className.trim().toLowerCase();

  if (VEHICLE_CLASSES.HV.includes(normalized)) {
    return "HV";
  }
  if (VEHICLE_CLASSES.LV.includes(normalized)) {
    return "LV";
  }
  if (VEHICLE_CLASSES.MC.includes(normalized)) {
    return "MC";
  }

  return null;
}

/**
 * Count detections grouped by LV, HV, and MC, filtering out ignored classes.
 *
 * @param {Array<{ class?: string, bbox?: number[] }>} detections
 * @returns {{ lv: number, hv: number, mc: number, total: number, matchedDetections: Array }}
 */
export function countDetectionsByCategory(detections = []) {
  let lv = 0;
  let hv = 0;
  let mc = 0;
  const matchedDetections = [];

  for (const item of detections) {
    const category = mapCocoClassToCategory(item && item.class);
    if (!category) {
      continue;
    }

    if (category === "LV") {
      lv += 1;
    } else if (category === "HV") {
      hv += 1;
    } else if (category === "MC") {
      mc += 1;
    }

    matchedDetections.push({
      ...item,
      category
    });
  }

  return {
    lv,
    hv,
    mc,
    total: lv + hv + mc,
    matchedDetections
  };
}

/**
 * Compute passenger car unit (smp) volume from raw vehicle counts using IHCM 1997 weights.
 *
 * @param {{ lv?: number, hv?: number, mc?: number }} counts
 * @returns {number}
 */
export function calculatePcuVolume({ lv = 0, hv = 0, mc = 0 } = {}) {
  return lv * PCU_WEIGHTS.LV + hv * PCU_WEIGHTS.HV + mc * PCU_WEIGHTS.MC;
}

/**
 * Compute intersection capacity (smp/hour) using IHCM 1997:
 * C = C0 * FCw * FCsp * FCsf * FCcs * lanes.
 *
 * @param {typeof DEFAULT_CAPACITY_PARAMS} params
 * @returns {number}
 */
export function calculateRoadCapacity(params = DEFAULT_CAPACITY_PARAMS) {
  const {
    baseCapacity = DEFAULT_CAPACITY_PARAMS.baseCapacity,
    fcw = DEFAULT_CAPACITY_PARAMS.fcw,
    fcsp = DEFAULT_CAPACITY_PARAMS.fcsp,
    fcsf = DEFAULT_CAPACITY_PARAMS.fcsf,
    fccs = DEFAULT_CAPACITY_PARAMS.fccs,
    lanes = DEFAULT_CAPACITY_PARAMS.lanes
  } = params;

  return baseCapacity * fcw * fcsp * fcsf * fccs * lanes;
}

/**
 * Scale an observation window PCU volume into an hourly rate (smp/hour).
 *
 * @param {number} windowVolumePcu
 * @param {number} windowSeconds
 * @returns {number}
 */
export function convertWindowVolumeToHourly(
  windowVolumePcu,
  windowSeconds = ANALYSIS_WINDOW_SECONDS
) {
  if (!windowSeconds || windowSeconds <= 0) {
    throw new Error("windowSeconds must be greater than 0");
  }

  return windowVolumePcu * (3600 / windowSeconds);
}

/**
 * Calculate the V/C ratio for a capture window.
 *
 * @param {{ lv?: number, hv?: number, mc?: number, windowSeconds?: number, capacityPerHour?: number }} options
 * @returns {number}
 */
export function calculateVcRatio({
  lv = 0,
  hv = 0,
  mc = 0,
  windowSeconds = ANALYSIS_WINDOW_SECONDS,
  capacityPerHour = DEFAULT_CAPACITY_PER_HOUR
} = {}) {
  if (!capacityPerHour || capacityPerHour <= 0) {
    throw new Error("capacityPerHour must be greater than 0");
  }

  const windowPcu = calculatePcuVolume({ lv, hv, mc });
  const hourlyPcu = convertWindowVolumeToHourly(windowPcu, windowSeconds);

  return hourlyPcu / capacityPerHour;
}

/**
 * Classify a V/C ratio into IHCM 1997 levels of service (A-F).
 *
 * @param {number} vcRatio
 * @returns {{ grade: string, label: string, color: string }}
 */
export function classifyVcRatio(vcRatio) {
  if (!Number.isFinite(vcRatio) || vcRatio < 0) {
    return NO_DATA_LEVEL;
  }

  if (vcRatio < 0.6) {
    return TRAFFIC_LEVELS[0];
  }
  if (vcRatio < 0.7) {
    return TRAFFIC_LEVELS[1];
  }
  if (vcRatio < 0.8) {
    return TRAFFIC_LEVELS[2];
  }
  if (vcRatio < 0.9) {
    return TRAFFIC_LEVELS[3];
  }
  if (vcRatio <= 1.0) {
    return TRAFFIC_LEVELS[4];
  }

  return TRAFFIC_LEVELS[5];
}

/**
 * Run end-to-end IHCM 1997 volume, V/C ratio, and classification for a capture window.
 *
 * @param {{ lv?: number, hv?: number, mc?: number, windowSeconds?: number, capacityPerHour?: number }} options
 */
export function classifyTrafficWindow({
  lv = 0,
  hv = 0,
  mc = 0,
  windowSeconds = ANALYSIS_WINDOW_SECONDS,
  capacityPerHour = DEFAULT_CAPACITY_PER_HOUR
} = {}) {
  const windowPcu = calculatePcuVolume({ lv, hv, mc });
  const hourlyPcu = convertWindowVolumeToHourly(windowPcu, windowSeconds);
  const vcRatio = hourlyPcu / capacityPerHour;
  const level = classifyVcRatio(vcRatio);

  return {
    lv,
    hv,
    mc,
    windowPcu,
    hourlyPcu,
    capacityPerHour,
    vcRatio,
    ...level
  };
}

/**
 * Resolve the map marker color hex for a stored condition label.
 *
 * @param {string | null | undefined} label
 * @returns {string}
 */
export function getColorForCondition(label) {
  const matched = TRAFFIC_LEVELS.find((level) => level.label === label);
  return matched ? matched.color : NO_DATA_LEVEL.color;
}

/**
 * Resolve the single-letter IHCM grade (or "?" for No Data) for a stored condition label.
 *
 * @param {string | null | undefined} label
 * @returns {string}
 */
export function getGradeForCondition(label) {
  const normalized = typeof label === "string" ? label.trim().toLowerCase() : "";
  const matched = TRAFFIC_LEVELS.find((level) => level.label.toLowerCase() === normalized);
  return matched ? matched.grade : "?";
}
