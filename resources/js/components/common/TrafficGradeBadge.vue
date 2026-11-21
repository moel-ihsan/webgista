<template>
  <span class="traffic-grade-wrap" :aria-label="accessibleLabel">
    <span class="grade-chip" :class="[`grade-chip--${chipCode}`, { 'grade-chip--sm': small }]">
      {{ chipDisplay }}
    </span>
    <span v-if="showLabel" class="traffic-grade-label">{{ displayLabel }}</span>
  </span>
</template>

<script>
import {
  NO_DATA_LEVEL,
  REGULAR_CAMERA_LEVEL,
  TRAFFIC_LEVELS
} from "../../services/traffic/ihcmClassifier";

export default {
  name: "TrafficGradeBadge",
  props: {
    status: {
      type: String,
      default: ""
    },
    grade: {
      type: String,
      default: ""
    },
    showLabel: {
      type: Boolean,
      default: false
    },
    small: {
      type: Boolean,
      default: false
    }
  },
  computed: {
    resolvedLevel() {
      const normalizedGrade = (this.grade || "").trim().toUpperCase();
      const normalizedStatus = (this.status || "").trim().toLowerCase();

      if (normalizedGrade === "R" || normalizedStatus === "regular") {
        return REGULAR_CAMERA_LEVEL;
      }

      const match = TRAFFIC_LEVELS.find(
        (level) =>
          (normalizedGrade && level.grade === normalizedGrade) ||
          (normalizedStatus && level.label.toLowerCase() === normalizedStatus)
      );

      return match || NO_DATA_LEVEL;
    },
    chipCode() {
      return this.resolvedLevel.grade || "N";
    },
    chipDisplay() {
      return this.resolvedLevel.grade || "?";
    },
    displayLabel() {
      return this.resolvedLevel.label;
    },
    accessibleLabel() {
      if (this.resolvedLevel.grade === "R") {
        return "CCTV Regular (Pantauan Non-Analitik)";
      }
      return this.resolvedLevel.grade
        ? `Kondisi ${this.resolvedLevel.grade} ${this.resolvedLevel.label}`
        : `Kondisi ${this.resolvedLevel.label}`;
    }
  }
};
</script>

<style>
.traffic-grade-wrap {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.traffic-grade-label {
  font-size: var(--text-caption);
  font-weight: 600;
  color: var(--text-primary);
}
</style>
