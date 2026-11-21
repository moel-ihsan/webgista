<template>
  <div id="panelLeft" class="sidebar-toggle rounded-rect left">
    <el-popover placement="right" width="220" trigger="click" class="map-popover">
      <div class="map-popover-section-title">Map Style</div>
      <el-radio-group id="mapStyle" :value="selectedStyle" class="radio-group-map">
        <el-radio
          v-for="item in styles"
          :id="item.id"
          :key="item.id"
          class="style-item"
          :label="item.label"
          @change.native="$emit('change-style', item)"
        >
          {{ item.label }}
        </el-radio>
      </el-radio-group>
      <div class="map-popover-section-title" style="margin-top: 12px">Layer</div>
      <el-checkbox-group :value="checkedLayers" @input="$emit('update:checked-layers', $event)">
        <el-checkbox label="cctv" @change="$emit('toggle-layer', 2)">CCTV</el-checkbox>
        <el-checkbox id="state-fills" label="adm" @change="$emit('toggle-layer', 1)">
          Banda Aceh ADM
        </el-checkbox>
      </el-checkbox-group>
      <button
        slot="reference"
        type="button"
        class="map-icon-trigger"
        aria-label="Pilih gaya dan layer peta"
        title="Map Style & Layer"
      >
        <AppIcon name="layers" :size="18" />
      </button>
    </el-popover>
  </div>
</template>

<script>
import { MAP_STYLES } from "../../config/map";

export default {
  name: "MapLayerControl",
  props: {
    selectedStyle: {
      type: String,
      default: "Street"
    },
    checkedLayers: {
      type: Array,
      default: () => ["cctv"]
    }
  },
  data() {
    return {
      styles: MAP_STYLES
    };
  }
};
</script>

<style>
.map-popover-section-title {
  font-size: var(--text-caption);
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 6px;
}

.map-icon-trigger {
  width: 44px;
  height: 44px;
  border: 0;
  background: transparent;
  color: var(--text-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  cursor: pointer;
}

.map-icon-trigger:hover {
  background-color: var(--bg-surface-subtle);
  color: var(--accent-primary);
}
</style>
