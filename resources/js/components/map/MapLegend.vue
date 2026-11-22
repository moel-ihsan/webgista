<template>
  <section id="state-legend" class="legend" aria-label="Map Legend">
    <div class="legend-header">
      <h2 class="legend-title">{{ title }}</h2>
      <button
        type="button"
        class="legend-toggle-btn"
        :aria-expanded="mobileExpanded ? 'true' : 'false'"
        :aria-label="mobileExpanded ? 'Collapse legend' : 'Expand legend'"
        @click="mobileExpanded = !mobileExpanded"
      >
        <AppIcon :name="mobileExpanded ? 'close' : 'layers'" :size="16" />
      </button>
    </div>

    <div class="legend-body" :class="{ 'legend-body--mobile-hidden': !mobileExpanded }">
      <div class="legend-items">
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

      <div v-if="secondaryItems && secondaryItems.length" class="legend-secondary">
        <h3 v-if="secondaryTitle" class="legend-subtitle">{{ secondaryTitle }}</h3>
        <div class="legend-items legend-items--secondary">
          <div v-for="item in secondaryItems" :key="item.label" class="legend-item">
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
    },
    secondaryTitle: {
      type: String,
      default: ""
    },
    secondaryItems: {
      type: Array,
      default: () => []
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

.legend-secondary {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border-subtle);
}

.legend-subtitle {
  margin: 0;
  font-size: var(--text-caption);
  font-weight: 700;
  color: var(--text-secondary);
}

.legend-items--secondary {
  margin-top: 5px;
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

  .legend-body--mobile-hidden {
    display: none;
  }
}
</style>
