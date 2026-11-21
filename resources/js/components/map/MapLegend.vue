<template>
  <section id="state-legend" class="legend" aria-label="Legenda Peta">
    <div class="legend-header">
      <h2 class="legend-title">{{ title }}</h2>
      <button
        type="button"
        class="legend-toggle-btn"
        :aria-expanded="mobileExpanded ? 'true' : 'false'"
        :aria-label="mobileExpanded ? 'Ciutkan legenda' : 'Buka legenda'"
        @click="mobileExpanded = !mobileExpanded"
      >
        <AppIcon :name="mobileExpanded ? 'close' : 'layers'" :size="16" />
      </button>
    </div>

    <div class="legend-items" :class="{ 'legend-items--mobile-hidden': !mobileExpanded }">
      <div v-for="item in items" :key="item.label" class="legend-item">
        <TrafficGradeBadge
          v-if="hasGradeBadge(item)"
          :grade="item.grade || ''"
          :status="item.label"
          :small="true"
        />
        <span
          v-else
          class="legend-dot"
          :style="{ backgroundColor: item.color }"
          aria-hidden="true"
        />
        <span class="legend-label">{{ item.label }}</span>
      </div>
    </div>
  </section>
</template>

<script>
export default {
  name: "MapLegend",
  props: {
    title: {
      type: String,
      required: true
    },
    items: {
      type: Array,
      required: true
    }
  },
  data() {
    return {
      mobileExpanded: true
    };
  },
  mounted() {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      this.mobileExpanded = false;
    }
  },
  methods: {
    hasGradeBadge(item) {
      return Boolean(item && (item.grade !== undefined || item.label === "No Data"));
    }
  }
};
</script>

<style>
.legend {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  bottom: 12px;
  box-shadow: var(--shadow-float);
  padding: 10px 12px;
  position: absolute;
  right: 12px;
  z-index: 10;
  color: var(--text-primary);
  min-width: 170px;
}

.legend-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.legend-title {
  margin: 0;
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--text-primary);
}

.legend-toggle-btn {
  display: none;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
  background-color: var(--bg-surface-subtle);
  color: var(--text-primary);
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.legend-items {
  display: grid;
  grid-template-columns: 1fr;
  gap: 5px;
  margin-top: 6px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--text-caption);
  font-weight: 600;
  color: var(--text-primary);
}

.legend-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
  border: 2px solid var(--border-input);
}

.legend-label {
  color: var(--text-primary);
}

@media screen and (max-width: 767px) {
  .legend {
    left: 12px;
    right: 12px;
    bottom: 48px;
    min-width: 0;
    padding: 8px 10px;
  }

  .legend-toggle-btn {
    display: inline-flex;
    min-width: 44px;
    min-height: 44px;
  }

  .legend-items {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px 10px;
  }

  .legend-items--mobile-hidden {
    display: none;
  }
}
</style>
