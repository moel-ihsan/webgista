<template>
  <div class="setting-container">
    <div class="settings-split-card">
      <div class="settings-form-panel">
        <h2 class="form-card-heading">Center The Map</h2>
        <el-form
          ref="settingform"
          class="setting-form"
          label-position="top"
          :model="settingform"
          :rules="rules"
          :hide-required-asterisk="true"
        >
          <el-form-item label="Latitude (N)" prop="lattitude">
            <el-input
              id="lattitude"
              v-model.number="settingform.lattitude"
              @change="handleCoordinateChange"
            />
          </el-form-item>
          <el-form-item label="Longitude (E)" prop="longitude">
            <el-input
              id="longitude"
              v-model.number="settingform.longitude"
              @change="handleCoordinateChange"
            />
          </el-form-item>
          <el-form-item label="Zoom" prop="zoom">
            <el-input
              id="zoom"
              v-model.number="settingform.zoom"
              @change="handleCoordinateChange"
            />
          </el-form-item>
        </el-form>

        <h2 class="form-card-heading" style="margin-top: 24px">Add Agency List</h2>
        <AgencyTagManager />
      </div>

      <div class="settings-map-panel" aria-label="Map center preview">
        <CoordinatePickerMap
          :longitude="settingform.longitude"
          :latitude="settingform.lattitude"
          :zoom="settingform.zoom"
          :selectable="true"
          popup-html="<div id='isi' class='map-popup-title'>Center Point</div>"
          @select-coordinate="onMapCoordinateSelected"
        />
      </div>
    </div>
  </div>
</template>

<script>
import AgencyTagManager from "./AgencyTagManager.vue";
import CoordinatePickerMap from "../map/CoordinatePickerMap.vue";
import { update as updateMapSetting } from "../../services/api/mapSettingApi";

export default {
  name: "MapSettingsPanel",
  components: {
    AgencyTagManager,
    CoordinatePickerMap
  },
  props: {
    setti: {
      type: Object,
      default: () => ({})
    },
    csrf: {
      type: String,
      default: ""
    }
  },
  data() {
    return {
      settingform: {
        lattitude: "",
        longitude: "",
        zoom: ""
      },
      rules: {
        lattitude: [{ required: true, message: "Input number", trigger: "blur" }],
        longitude: [{ required: true, message: "Input number", trigger: "blur" }],
        zoom: [{ required: true, message: "Input number", trigger: "blur" }]
      }
    };
  },
  created() {
    if (this.setti) {
      this.settingform.lattitude = this.setti.lattitude;
      this.settingform.longitude = this.setti.longitude;
      this.settingform.zoom = this.setti.zoom;
    }
  },
  methods: {
    persistSettings() {
      if (!this.setti || !this.setti.id || !this.$refs.settingform) {
        return;
      }

      this.$refs.settingform.validate((valid) => {
        if (!valid) {
          return;
        }

        updateMapSetting(this.setti.id, {
          lattitude: this.settingform.lattitude,
          longitude: this.settingform.longitude,
          zoom: this.settingform.zoom
        }).catch(() => {});
      });
    },
    handleCoordinateChange() {
      this.persistSettings();
    },
    onMapCoordinateSelected({ latitude, longitude, zoom }) {
      this.settingform.lattitude = latitude;
      this.settingform.longitude = longitude;
      this.settingform.zoom = zoom;
      this.persistSettings();
    }
  }
};
</script>

<style>
.settings-split-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-card);
}

.settings-form-panel {
  padding: var(--space-6);
  min-width: 0;
}

.settings-map-panel {
  position: relative;
  min-height: 460px;
  border-left: 1px solid var(--border-subtle);
  background-color: var(--bg-surface-subtle);
}

.map-popup-title {
  font-weight: 700;
  font-size: var(--text-sm);
  color: var(--text-primary);
  padding: 4px 44px 4px 4px;
}

@media screen and (max-width: 1023px) {
  .settings-split-card {
    grid-template-columns: 1fr;
  }

  .settings-form-panel {
    padding: var(--space-4);
  }

  .settings-map-panel {
    border-left: 0;
    border-top: 1px solid var(--border-subtle);
    min-height: 360px;
    height: 360px;
  }
}
</style>
