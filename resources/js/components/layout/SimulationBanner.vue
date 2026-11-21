<template>
  <div v-if="isVisible" class="simulation-demo-banner" role="status">
    <span class="simulation-demo-badge">SIMULASI</span>
    <span class="simulation-demo-text">{{ bannerText }}</span>
  </div>
</template>

<script>
import { getSimulationConfig } from "../../config/simulation";

export default {
  name: "SimulationBanner",
  data() {
    return {
      simulation: getSimulationConfig()
    };
  },
  computed: {
    isVisible() {
      return Boolean(this.simulation && this.simulation.enabled && this.bannerText);
    },
    bannerText() {
      return (
        (this.simulation && this.simulation.bannerText) ||
        "SIMULASI DEMO — Menggunakan video contoh lalu lintas, bukan data CCTV resmi Kota Banda Aceh."
      );
    }
  }
};
</script>

<style>
.simulation-demo-banner {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 10px 16px;
  margin-bottom: var(--space-3);
  border-radius: var(--radius-md);
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  box-shadow: var(--shadow-card);
}

.simulation-demo-badge {
  flex-shrink: 0;
  padding: 3px 10px;
  border-radius: var(--radius-pill);
  background-color: var(--accent-soft-bg);
  color: var(--accent-soft-text);
  border: 1px solid var(--accent-soft-border);
  font-weight: 700;
  font-size: var(--text-caption);
  letter-spacing: 0.04em;
}

.simulation-demo-text {
  line-height: 1.45;
  color: var(--text-secondary);
}
</style>
