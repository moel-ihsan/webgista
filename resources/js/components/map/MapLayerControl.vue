<template>
  <div id="panelLeft" class="sidebar-toggle rounded-rect left">
    <el-popover placement="right" width="200" trigger="click" class="map-popover">
      <p style="opacity: 0.5">Map Style</p>
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
      <p style="opacity: 0.5; margin-bottom: 10px">Layer</p>
      <el-checkbox-group :value="checkedLayers" @input="$emit('update:checked-layers', $event)">
        <el-checkbox label="cctv" @change="$emit('toggle-layer', 2)">CCTV</el-checkbox>
        <el-checkbox id="state-fills" label="adm" @change="$emit('toggle-layer', 1)">
          Banda Aceh ADM
        </el-checkbox>
      </el-checkbox-group>
      <ion-icon slot="reference" name="layers" />
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
