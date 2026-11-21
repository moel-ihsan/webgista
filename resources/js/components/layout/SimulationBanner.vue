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
  gap: 10px;
  padding: 8px 14px;
  margin-bottom: 14px;
  border-radius: 10px;
  background-color: var(--color-secondary);
  border: 1px solid var(--green-theme-30);
  color: var(--text-color);
  font-size: var(--size-sm);
  box-shadow: 0 4px 12px rgba(29, 29, 29, 0.08);
}

.simulation-demo-badge {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 6px;
  background-color: var(--green-theme);
  color: #fff;
  font-weight: 700;
  font-size: var(--size-xs);
  letter-spacing: 0.04em;
}

.simulation-demo-text {
  line-height: 1.4;
}
</style>
