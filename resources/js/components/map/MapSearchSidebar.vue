<template>
  <div class="map-search-root">
    <button
      id="mapSeacrh"
      type="button"
      class="map-search-pill rounded-rect"
      :aria-expanded="isCollapsed ? 'false' : 'true'"
      :aria-label="
        isCollapsed
          ? `Buka panel pencarian CCTV (${resolvedTotalCount} titik)`
          : `Tutup panel pencarian CCTV (${resolvedTotalCount} titik)`
      "
      @click="$emit('toggle')"
    >
      <AppIcon :name="isCollapsed ? 'search' : 'close'" :size="17" />
      <span>CCTV ({{ resolvedTotalCount }})</span>
    </button>

    <aside
      id="right"
      class="sidebar right"
      :class="{ collapsed: isCollapsed }"
      :aria-hidden="isCollapsed ? 'true' : 'false'"
      aria-label="Pencarian dan daftar titik CCTV"
    >
      <div class="sidebar-content rounded-rect">
        <div class="map-search-header">
          <label for="map-search-input" class="map-search-label">Cari Persimpangan / Status</label>
          <input
            id="map-search-input"
            type="search"
            class="map-search-input"
            :value="filterText"
            placeholder="Ketik nama atau status A–F..."
            @input="$emit('update:filter-text', $event.target.value)"
          />
        </div>

        <div class="search-card-item">
          <button
            v-for="item in items"
            :id="String(item.id)"
            :key="item.id"
            type="button"
            class="search-info-card"
            @click="$emit('select', item.id)"
          >
            <div class="search-icon">
              <img class="search-img" :src="item.imageUrl" :alt="'Pratinjau CCTV ' + item.name" />
            </div>
            <div class="search-content">
              <div class="name">{{ item.name }}</div>
              <div class="search-meta">{{ formatMetaLine(item) }}</div>
            </div>
            <TrafficGradeBadge :grade="item.grade || ''" :status="item.cond || ''" />
          </button>

          <div v-if="items.length === 0" class="ui-state-box" style="margin-top: 8px">
            Tidak ada titik CCTV yang cocok.
          </div>
        </div>
      </div>
    </aside>
  </div>
</template>

<script>
export default {
  name: "MapSearchSidebar",
  props: {
    items: {
      type: Array,
      default: () => []
    },
    totalCount: {
      type: Number,
      default: null
    },
    filterText: {
      type: String,
      default: ""
    },
    isCollapsed: {
      type: Boolean,
      default: true
    }
  },
  computed: {
    resolvedTotalCount() {
      return typeof this.totalCount === "number" ? this.totalCount : this.items.length;
    }
  },
  methods: {
    formatMetaLine(item) {
      const rawAddress = (item && item.address) || "";
      const street = rawAddress.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
      const cond = (item && item.cond) || "No Data";
      return street ? `${street} · ${cond}` : cond;
    }
  }
};
</script>

<style>
.map-search-pill {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 16;
  min-height: 44px;
  padding: 0 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--text-primary);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.map-search-pill:hover {
  background-color: var(--bg-surface-subtle);
  color: var(--accent-primary);
  border-color: var(--accent-primary);
}

.map-search-header {
  padding: 0 4px;
  margin-bottom: 4px;
}

.map-search-label {
  display: block;
  font-size: var(--text-caption);
  font-weight: 700;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.map-search-input {
  width: 100%;
  min-height: 44px;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-input);
  background-color: var(--bg-surface-subtle);
  color: var(--text-primary);
  font-size: var(--text-sm);
}

.map-search-input::placeholder {
  color: var(--text-muted);
}

.search-card-item {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 6px 4px 10px 4px;
}

.search-info-card {
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  background-color: var(--bg-surface-subtle);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  min-height: 70px;
  transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
}

.search-info-card:hover {
  border-color: var(--accent-primary);
  box-shadow: var(--shadow-card);
  transform: translateY(-1px);
}

.search-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  flex-shrink: 0;
  background-color: var(--bg-canvas);
}

.search-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.4s ease;
}

.search-info-card:hover .search-img {
  transform: scale(1.15);
}

.search-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.search-content .name {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-meta {
  font-size: var(--text-caption);
  font-weight: 500;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
