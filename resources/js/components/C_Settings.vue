<template>
  <div>
    <div class="setting-container">
      <div class="form-container">
        <div class="title-center-set-map" style="margin-bottom: 20px">
          Center The Map
        </div>
        <el-form
          class="setting-form"
          :label-position="labelPosition"
          label-width="100px"
          :model="settingform"
          ref="settingform"
        >
          <el-form-item label="Lattitude (N)" prop="lattitude">
            <el-input
              v-model.number="settingform.lattitude"
              @change="handleCoordinat('x')"
            ></el-input>
          </el-form-item>
          <el-form-item label="Longitude (E)" prop="longitude">
            <el-input
              v-model.number="settingform.longitude"
              @change="handleCoordinat('y')"
            ></el-input>
          </el-form-item>
          <el-form-item label="Zoom" prop="type">
            <el-input
              v-model.number="settingform.zoom"
              @change="handleCoordinat('z')"
            ></el-input>
          </el-form-item>
          <!-- <el-row>
            <el-col :span="12" :xs="24">
              <el-form-item>
                <div class="btn-form-submit">
                  <el-button type="info" @click="handleCancel"
                    >Cancel</el-button
                  >
                  <el-button
                    :loading="loading"
                    type="primary"
                    @click="onSubmit('settingform')"
                    >Submit</el-button
                  >
                </div>
              </el-form-item>
            </el-col>
          </el-row> -->
        </el-form>
        <div class="title-center-set-map" style="margin: 20px 0">
          Add Agency List
        </div>
        <div class="tag-container-settings">
          <el-tag
            :key="tag"
            v-for="tag in dynamicTags"
            closable
            :disable-transitions="false"
            @close="handleClose(tag)"
          >
            {{ tag.agency }}
          </el-tag>
          <el-input
            class="input-new-tag"
            v-if="inputVisible"
            v-model="inputValue"
            ref="saveTagInput"
            size="mini"
            @keyup.enter.native="handleInputConfirm"
            @blur="handleInputConfirm"
          >
          </el-input>
          <el-button
            v-else
            class="button-new-tag"
            size="small"
            @click="showInput"
            >+ New Tag</el-button
          >
        </div>
        <div class="set-map-container">
          <div id="map"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import mapboxgl from "mapbox-gl";

export default {
  props: {
    cctv: { type: Object },
    setti: { type: Object },
    csrf: { type: String },
  },
  name: "set-map-container",
  data() {
    return {
      accessToken:
        "pk.eyJ1IjoibW9lbC1paHNhbiIsImEiOiJjazljdmFhNzYwNnV2M21yM3IxaHgwamVnIn0.suuGn0UAUi-ud4rV2QCe4Q",
      labelPosition: "top",
      settingform: {
        lattitude: "",
        longitude: "",
        zoom: "",
      },
      dynamicTags: [],
      inputVisible: false,
      inputValue: "",
      map: {},
      rules: {
        lattitude: [
          {
            required: true,
            // type: "text",
            message: "Input number",
            trigger: "blur",
          },
        ],
        longitude: [
          {
            required: true,
            // type: "number",
            message: "Input number",
            trigger: "blur",
          },
        ],
        zoom: [
          {
            required: true,
            // type: "number",
            message: "Input number",
            trigger: "blur",
          },
        ],
      },
      center: [95.327800887501041, 5.5528745289364],
    };
  },
  created() {
    this.fetchAgency();
    // this.fetchSetting();
    this.settingform.lattitude = this.setti.lattitude;
    this.settingform.longitude = this.setti.longitude;
    this.settingform.zoom = this.setti.zoom;
  },
  methods: {
    onSubmit(formName) {
      // this.loading = true;
      // console.log(this.csrf);
      this.$refs[formName].validate((valid) => {
        if (valid) {
          axios
            .patch(
              `/updateSetting/${this.setti.id}`,
              {
                lattitude: this.settingform.lattitude,
                longitude: this.settingform.longitude,
                zoom: this.settingform.zoom,
              },
              {
                headers: {
                  "Csrf-Token": this.csrf,
                },
              }
            )
            .then((response) => {
              console.log(response.data);
            })
            .catch((error) => {
              console.log(error);
              this.loading = false;
            });
        } else {
          this.loading = false;
        }
      });
    },
    handleCoordinat(res, type) {
      if (
        this.settingform.longitude &&
        this.settingform.lattitude &&
        this.settingform.zoom
      ) {
        console.log(this.popup);

        let map = this.map;
        let tes = [this.settingform.longitude, this.settingform.lattitude];
        let zoom = this.settingform.zoom;
        map.setCenter(tes);
        map.setZoom(zoom);
        this.popup.setLngLat(tes);
        map.getSource("points").setData({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: tes,
              },
            },
          ],
        });
      }
      this.onSubmit("settingform");
    },

    fetchAgency() {
      this.dynamicTags = [];
      axios.get("/api/agency").then((res) => {
        // console.log(res.data);
        this.total = res.data.length;
        res.data.forEach((row, index) => {
          this.dynamicTags.push({
            id: row.id,
            agency: row.agency,
          });
        });
      });
    },
    handleClose(tag) {
      axios.get(`/destroyAgent/${tag.agency}`);
      this.dynamicTags.splice(this.dynamicTags.indexOf(tag), 1);
      // this.fetchAgency();
    },

    showInput() {
      this.inputVisible = true;
      this.$nextTick((_) => {
        this.$refs.saveTagInput.$refs.input.focus();
      });
    },

    handleInputConfirm() {
      let inputValue = this.inputValue;
      if (inputValue) {
        axios.post("/store/agency", {
          agency: this.inputValue,
        });
        this.dynamicTags.push({ agency: inputValue });
        // this.fetchAgency();
      }
      this.inputVisible = false;
      this.inputValue = "";
    },
  },

  mounted() {
    mapboxgl.accessToken = this.accessToken;
    var center = [this.setti.longitude, this.setti.lattitude];
    var zoom = this.setti.zoom;
    var map = new mapboxgl.Map({
      container: "map",
      style: "mapbox://styles/mapbox/streets-v11",
      center: center,
      minZoom: 2,
      zoom: zoom,
    });
    this.map = map;

    var popup = new mapboxgl.Popup({ closeOnClick: false, offset: 15 })
      .setLngLat(center)
      .setHTML("<h1 id='isi'>Center Point</h1>")
      .addTo(map);
    this.popup = popup;
    var size = 100;

    // implementation of CustomLayerInterface to draw a pulsing dot icon on the map
    // see https://docs.mapbox.com/mapbox-gl-js/api/#customlayerinterface for more info
    var pulsingDot = {
      width: size,
      height: size,
      data: new Uint8Array(size * size * 4),

      // get rendering context for the map canvas when layer is added to the map
      onAdd: function () {
        var canvas = document.createElement("canvas");
        canvas.width = this.width;
        canvas.height = this.height;
        this.context = canvas.getContext("2d");
      },

      // called once before every frame where the icon will be used
      render: function () {
        var duration = 1000;
        var t = (performance.now() % duration) / duration;

        var radius = (size / 2) * 0.3;
        var outerRadius = (size / 2) * 0.7 * t + radius;
        var context = this.context;

        // draw outer circle
        context.clearRect(0, 0, this.width, this.height);
        context.beginPath();
        context.arc(
          this.width / 2,
          this.height / 2,
          outerRadius,
          0,
          Math.PI * 2
        );
        context.fillStyle = "rgba(255, 200, 200," + (1 - t) + ")";
        context.fill();

        // draw inner circle
        context.beginPath();
        context.arc(this.width / 2, this.height / 2, radius, 0, Math.PI * 2);
        context.fillStyle = "rgba(255, 100, 100, 1)";
        context.strokeStyle = "white";
        context.lineWidth = 2 + 4 * (1 - t);
        context.fill();
        context.stroke();

        // update this image's data with data from the canvas
        this.data = context.getImageData(0, 0, this.width, this.height).data;

        // continuously repaint the map, resulting in the smooth animation of the dot
        map.triggerRepaint();

        // return `true` to let the map know that the image was updated
        return true;
      },
    };

    map.on("load", function () {
      map.addImage("pulsing-dot", pulsingDot, { pixelRatio: 2 });

      map.addSource("points", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: center,
              },
            },
          ],
        },
      });
      map.addLayer({
        id: "points",
        type: "symbol",
        source: "points",
        layout: {
          "icon-image": "pulsing-dot",
        },
      });
    });

    map.on('click', (e) => {
      const coords = e.lngLat;
      this.settingform.lattitude = coords.lat;
      this.settingform.longitude = coords.lng;
      this.settingform.zoom = map.getZoom();
      this.handleCoordinat('x');
      this.handleCoordinat('y');
      this.onSubmit("settingform");
    });
  },
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

.tag-container-settings .el-tag {
  background-color: transparent;
  border-color: var(--green-theme);
  color: var(--green-theme);
  border-radius: 100px;
}

.el-tag .el-tag__close {
  color: var(--green-theme-30);
}

.el-tag .el-tag__close:hover {
  color: var(--green-theme);
  background-color: transparent;
}

.el-tag + .el-tag {
  margin-left: 10px;
  margin-bottom: 10px;
}
.button-new-tag {
  margin-left: 10px;
  height: 32px;
  line-height: 30px;
  padding-top: 0;
  padding-bottom: 0;
}
.input-new-tag {
  width: 90px;
  margin-left: 10px;
  margin-bottom: 10px;
  vertical-align: bottom;
}
.el-form-item {
  margin-bottom: 10px;
}

.tag-container-settings,
.el-form-item {
  width: 50%;
}

.tag-container-settings .el-button--mini,
.tag-container-settings .el-button--small {
  border-radius: 100px;
}
.tag-container-settings .el-button {
  background: transparent;
  border: 1px solid var(--text-color);
  color: var(--text-color);
  transition: 0.5s;
}
.tag-container-settings .el-button:hover,
.tag-container-settings .el-button:focus {
  background: transparent;
  border: 1px solid var(--green-theme);
  color: var(--green-theme);
}

.tag-container-settings .el-input__inner {
  border-radius: 100px;
}

.tag-container-settings .el-input .el-input__inner {
  box-shadow: none;
  border: 1px solid var(--green-theme-30);
}

.tag-container-settings .el-input .el-input__inner:hover,
.tag-container-settings .el-input .el-input__inner:focus {
  border-color: var(--green-theme);
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
  .tag-container-settings,
  .el-form-item {
    width: 50%;
  }
}
@media screen and (max-width: 600px) {
  .form-container .el-form-item {
    width: 100%;
    margin-bottom: 10px;
    padding-right: 0px;
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
