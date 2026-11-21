import {
  ANALYSIS_WINDOW_SECONDS,
  DEFAULT_CAPACITY_PER_HOUR,
  classifyTrafficWindow,
  countDetectionsByCategory
} from "./ihcmClassifier";

/**
 * Tracks 30-second traffic analysis windows, resetting counts to 0 on window rollover or video loop.
 */
export class TrafficWindowTracker {
  /**
   * @param {number} windowSeconds
   * @param {number} capacityPerHour
   */
  constructor(
    windowSeconds = ANALYSIS_WINDOW_SECONDS,
    capacityPerHour = DEFAULT_CAPACITY_PER_HOUR
  ) {
    this.windowSeconds = windowSeconds;
    this.capacityPerHour = capacityPerHour;
    this.reset();
  }

  /**
   * Reset all accumulated counts and window timing state.
   */
  reset() {
    this.windowStart = null;
    this.lastTimestamp = null;
    this.counts = { lv: 0, hv: 0, mc: 0 };
    this.lastClassification = null;
    this.hasPersistedInWindow = false;
  }

  /**
   * Record detections from a captured frame at `timestampSeconds`.
   *
   * @param {Array<{ class?: string, bbox?: number[] }>} detections
   * @param {number} timestampSeconds
   */
  recordCapture(detections = [], timestampSeconds = 0) {
    const safeTime =
      Number.isFinite(timestampSeconds) && timestampSeconds >= 0 ? timestampSeconds : 0;
    let windowReset = false;
    let completedClassification = null;

    if (this.windowStart === null) {
      this.windowStart = safeTime;
      windowReset = true;
    } else if (safeTime < this.lastTimestamp || safeTime - this.windowStart >= this.windowSeconds) {
      completedClassification = this.lastClassification;
      this.counts = { lv: 0, hv: 0, mc: 0 };
      this.windowStart = safeTime;
      this.hasPersistedInWindow = false;
      windowReset = true;
    }

    const frameCounts = countDetectionsByCategory(detections);
    this.counts = {
      lv: this.counts.lv + frameCounts.lv,
      hv: this.counts.hv + frameCounts.hv,
      mc: this.counts.mc + frameCounts.mc
    };
    this.lastTimestamp = safeTime;

    const classification = classifyTrafficWindow({
      ...this.counts,
      windowSeconds: this.windowSeconds,
      capacityPerHour: this.capacityPerHour
    });

    const labelChanged =
      !this.lastClassification || this.lastClassification.label !== classification.label;
    const shouldPersist = windowReset || !this.hasPersistedInWindow || labelChanged;

    if (shouldPersist) {
      this.hasPersistedInWindow = true;
    }

    this.lastClassification = classification;

    return {
      windowReset,
      shouldPersist,
      elapsedSeconds: Math.max(0, safeTime - this.windowStart),
      frameCounts,
      counts: { ...this.counts },
      classification,
      completedClassification
    };
  }
}
