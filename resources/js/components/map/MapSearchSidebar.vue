<template>
  <aside
    id="right"
    class="sidebar flex-center right"
    :class="{ collapsed: isCollapsed }"
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
          placeholder="Ketik nama, jalan, atau status..."
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
            <div class="search-title-row">
              <span class="name">{{ item.name }}</span>
              <TrafficGradeBadge :grade="item.grade || ''" :status="item.cond || ''" :small="true" />
            </div>
            <div class="coordinate">{{ item.coordinate }}</div>
            <div class="address">{{ truncateAddress(item.address) }}</div>
            <span
              class="search-category-pill"
              :class="item.status === 'Regular' ? 'search-category-pill--muted' : 'search-category-pill--accent'"
            >
              {{ item.status }}
            </span>
          </div>
        </button>

        <div v-if="items.length === 0" class="ui-state-box" style="margin-top: 12px">
          Tidak ada titik CCTV yang cocok.
        </div>
      </div>

      <button
        id="mapSeacrh"
        type="button"
        class="sidebar-toggle rounded-rect right"
        :aria-expanded="isCollapsed ? 'false' : 'true'"
        :aria-label="isCollapsed ? 'Buka panel pencarian CCTV' : 'Tutup panel pencarian CCTV'"
        @click="$emit('toggle')"
      >
        <AppIcon v-if="isCollapsed === false" name="close" :size="18" />
        <AppIcon v-else name="search" :size="18" />
      </button>
    </div>
  </aside>
</template>

<script>
export default {
  name: "MapSearchSidebar",
  props: {
    items: {
      type: Array,
      default: () => []
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
  methods: {
    truncateAddress(address) {
      if (!address) {
        return "";
      }
      return address.length > 34 ? `${address.slice(0, 34)}…` : address;
    }
  }
};
</script>

<style>
.map-search-header {
  margin-bottom: var(--space-2);
}

.map-search-label {
  display: block;
  font-size: var(--text-caption);
  font-weight: 700;
  color: var(--text-secondary);
  margin-bottom: 4px;
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
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-right: 2px;
}

.search-info-card {
  width: 100%;
  text-align: left;
  padding: 10px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  background-color: var(--bg-surface-subtle);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  min-height: 72px;
  transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
}

.search-info-card:hover {
  border-color: var(--accent-primary);
  box-shadow: var(--shadow-card);
  transform: translateY(-1px);
}

.search-icon {
  width: 64px;
  height: 64px;
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
}

.search-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.search-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.name {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.coordinate {
  font-size: var(--text-caption);
  font-weight: 600;
  color: var(--accent-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.address {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  line-height: 1.35;
}

.search-category-pill {
  align-self: flex-start;
  margin-top: 2px;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  font-size: 11px;
  font-weight: 700;
}

.search-category-pill--accent {
  background-color: var(--accent-soft-bg);
  color: var(--accent-soft-text);
  border: 1px solid var(--accent-soft-border);
}

.search-category-pill--muted {
  background-color: var(--tag-bg-primary);
  color: var(--tag-text-primary);
  border: 1px solid var(--border-subtle);
}
</style>
