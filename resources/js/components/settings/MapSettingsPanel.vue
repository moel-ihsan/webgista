<template>
  <div>
    <div class="setting-container">
      <div class="form-container">
        <div class="title-center-set-map" style="margin-bottom: 20px">Center The Map</div>
        <el-form
          ref="settingform"
          class="setting-form"
          :label-position="labelPosition"
          label-width="100px"
          :model="settingform"
          :rules="rules"
          :hide-required-asterisk="true"
        >
          <el-form-item label="Lattitude (N)" prop="lattitude">
            <el-input v-model.number="settingform.lattitude" @change="handleCoordinateChange" />
          </el-form-item>
          <el-form-item label="Longitude (E)" prop="longitude">
            <el-input v-model.number="settingform.longitude" @change="handleCoordinateChange" />
          </el-form-item>
          <el-form-item label="Zoom" prop="zoom">
            <el-input v-model.number="settingform.zoom" @change="handleCoordinateChange" />
          </el-form-item>
        </el-form>

        <div class="title-center-set-map" style="margin: 20px 0">Add Agency List</div>
        <AgencyTagManager />

        <div class="set-map-container">
          <CoordinatePickerMap
            :longitude="settingform.longitude"
            :latitude="settingform.lattitude"
            :zoom="settingform.zoom"
            :selectable="true"
            popup-html="<h1 id='isi'>Center Point</h1>"
            @select-coordinate="onMapCoordinateSelected"
          />
        </div>
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
      labelPosition: "top",
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
#isi {
  font-weight: 500;
  font-size: var(--size-md);
  display: inline-block;
}

.form-container {
  position: relative;
  padding: 40px;
  background-color: var(--color-secondary);
  border-radius: 10px;
  box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
  -webkit-box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
  -moz-box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
}

.el-form-item__label {
  color: var(--text-color);
  opacity: 0.5;
  margin-bottom: -15px;
}

.el-form-item__content .el-input .el-input__inner {
  box-shadow: none;
  border: 1px solid var(--green-theme-30);
}

.el-form-item__content .el-input .el-input__inner:hover,
.el-form-item__content .el-input .el-input__inner:focus {
  border-color: var(--green-theme);
}

.form-container .el-form-item {
  width: 50%;
  margin-bottom: 10px;
  padding-right: 30px;
}

.el-form-item {
  margin-bottom: 10px;
}

.set-map-container {
  position: absolute;
  background: white;
  display: flex;
  align-items: center;
  border-radius: 10px;
  height: 100%;
  width: 50%;
  top: 0;
  right: 0;
  box-shadow: -10px 0 20px rgba(29, 29, 29, 0.2);
  -webkit-box-shadow: -10px 0 20px rgba(29, 29, 29, 0.2);
  -moz-box-shadow: -10px 0 20px rgba(29, 29, 29, 0.2);
}

#map {
  position: absolute;
  top: 0;
  border-radius: 10px;
  bottom: 0;
  width: 100%;
}

.mapboxgl-ctrl-attrib.mapboxgl-compact {
  display: none;
}

@media screen and (max-width: 992px) {
  .form-container .el-form-item {
    width: 50%;
  }
}

@media screen and (max-width: 600px) {
  .form-container .el-form-item {
    width: 100%;
    margin-bottom: 10px;
    padding-right: 0;
  }

  .set-map-container {
    top: 102%;
    width: 100%;
    left: 0;
    box-shadow: 0px -10px 20px rgba(29, 29, 29, 0.2);
    -webkit-box-shadow: 0px -10px 20px rgba(29, 29, 29, 0.2);
    -moz-box-shadow: 0px -10px 20px rgba(29, 29, 29, 0.2);
  }

  #map {
    position: absolute;
    top: 0;
    border-radius: 10px;
    left: 0;
    width: 100%;
  }
}
</style>
