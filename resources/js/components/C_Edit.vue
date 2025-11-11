<template>
  <div>
    <div class="add-page-container">
      <div class="add-container">
        <div class="title-center-set-map">Edit New CCTV</div>

        <el-form
          class="setting-form"
          :label-position="labelPosition"
          label-width="100px"
          :model="formLabelAlign"
          :rules="rules"
          ref="formLabelAlign"
          ><el-row>
            <el-col :span="6" :xs="24">
              <el-form-item label="Name" prop="name">
                <el-input v-model="formLabelAlign.name"></el-input>
              </el-form-item>
            </el-col>
            <el-col :span="6" :xs="24">
              <el-form-item label="Category" prop="category">
                <el-select
                  v-model="formLabelAlign.category"
                  @change="handleCategory(formLabelAlign.category)"
                  placeholder="Select"
                >
                  <el-option
                    v-for="item in catList"
                    empty-text="No Data"
                    :key="item.catValue"
                    :label="item.label"
                    :value="item.catValue"
                  >
                  </el-option>
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row>
            <el-col :span="12" :xs="24">
              <el-form-item label="Address" prop="address">
                <el-input v-model="formLabelAlign.address"></el-input>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row>
            <el-col :span="6" :xs="24">
              <el-form-item label="Lattitude (N)" prop="lattitude">
                <el-input
                  v-model.number="formLabelAlign.lattitude"
                  @change="handleCoordinat('x')"
                ></el-input>
              </el-form-item>
            </el-col>
            <el-col :span="6" :xs="24">
              <el-form-item label="Longitude (E)" prop="longitude">
                <el-input
                  v-model.number="formLabelAlign.longitude"
                  @change="handleCoordinat('y')"
                ></el-input>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row>
            <el-col :span="6" :xs="24">
              <el-form-item label="Agency" prop="agency">
                <!-- <el-input v-model="formLabelAlign.agency"></el-input> -->
                <el-select v-model="formLabelAlign.agency" placeholder="Select">
                  <el-option
                    v-for="item in agenList"
                    :key="item.agenValue"
                    :label="item.label"
                    :value="item.agenValue"
                  >
                  </el-option>
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="6" :xs="24">
              <el-form-item label="Image" prop="image">
                <!-- <input type="file" @change="onHandleUpload" name="image" /> -->
                <!-- v-model="formLabelAlign.image" -->
                <el-upload
                  :show-file-list="false"
                  :auto-upload="false"
                  action=""
                  :on-change="onHandleUpload"
                  :on-success="handleAvatarSuccess"                  
                  :multiple="false"
                >
                  <el-button size="small" type="primary"
                    >Click to upload</el-button
                  >
                  <span>{{ imageUrl }}</span>
                </el-upload>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row v-if="showUrl">
            <el-col :span="12" :xs="24">
              <el-form-item label="URL" prop="url">
                <el-input v-model="formLabelAlign.url"></el-input>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row>
            <el-col :span="12" :xs="24">
              <el-form-item>
                <div class="btn-form-submit">
                  <el-button type="info" @click="handleCancel"
                    >Cancel</el-button
                  >
                  <el-button
                    :loading="loading"
                    type="primary"
                    @click="onSubmit('formLabelAlign')"
                    >Submit</el-button
                  >
                </div>
              </el-form-item>
            </el-col>
          </el-row>
        </el-form>
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
    csrf: { type: String },
  },
  name: "set-map-container",
  data() {
    return {
      accessToken:
        "pk.eyJ1IjoibW9lbC1paHNhbiIsImEiOiJjazljdmFhNzYwNnV2M21yM3IxaHgwamVnIn0.suuGn0UAUi-ud4rV2QCe4Q",
      labelPosition: "top",
      formLabelAlign: {
        name: "",
        category: "",
        address: "",
        lattitude: "",
        longitude: "",
        agency: "",
        url: "",
      },
      imageUrl: "",
      showUrl: true,
      rules: {
        name: [
          {
            required: true,
            message: "Please input name",
            trigger: "blur",
          },
        ],
        category: [
          {
            required: true,
            message: "Please input category",
            trigger: "blur",
          },
        ],
        address: [
          {
            required: true,
            message: "Please input address",
            trigger: "blur",
          },
        ],
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
        agency: [
          {
            required: true,
            message: "Please input agency",
            trigger: "blur",
          },
        ],
        url: [
          {
            required: false,
            message: "Please input url",
            trigger: "blur",
          },
        ],
      },
      catList: [
        {
          catValue: "Regular",
          label: "Regular",
        },
        {
          catValue: "Analytic",
          label: "Analytic",
        },
      ],
      catValue: "",
      agenList: [],
      data: {},
      agenValue: "",
      fileList: [
        {
          name: "tf1.jpg",
        },
      ],
      file: "",
      map: {},
      loading: false,
      popup: {},
      center: [95.327800887501041, 5.5528745289364],
    };
  },
  created() {
    this.fetchAgency();

    this.formLabelAlign.name = this.cctv.name;
    this.formLabelAlign.category = this.cctv.category;
    this.formLabelAlign.address = this.cctv.address;
    this.formLabelAlign.lattitude = this.cctv.lattitude;
    this.formLabelAlign.longitude = this.cctv.longitude;
    this.formLabelAlign.agency = this.cctv.agency;
    this.formLabelAlign.url = this.cctv.url;
    this.showUrl = this.cctv.category == "Analytic";
  },
  methods: {
    handleCategory(value) {
      if (value == "Analytic") this.showUrl = true;
      else this.showUrl = false;
    },
    fetchAgency() {
      // this.dynamicTags = [];
      axios.get("/api/agency").then((res) => {
        // console.log(res.data);
        this.total = res.data.length;
        // console.log(res.data);
        res.data.forEach((row, index) => {
          this.agenList.push({
            agenValue: row.agency,
            label: row.agency,
          });
        });
      });
    },
    handleCancel() {
      window.history.back();
    },
    handleAvatarSuccess(res, file) {
      // console.log(res.data);
      // console.log(file);
      // this.formLabelAlign.image = this.imageUrl;
    },    
    onHandleUpload(file) {
      const tes = document.querySelector(".popup-img");
      tes.src = URL.createObjectURL(file.raw);
      let formData = new FormData();
      formData.append("image", file.raw);

      // this.formLabelAlign.image = file.raw;
      this.imageUrl = file.name;

      axios
        .post(`/uploadEdit/${this.cctv.id}`, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        })
        .then((response) => {
          console.log(response.data);
        })
        .catch((error) => {
          this.$message({
            message: "Failed Adding Data",
            type: "error",
          });
          console.log(error);
        });
    },
    handleCoordinat(res, type) {
      if (this.formLabelAlign.longitude && this.formLabelAlign.lattitude) {
        let map = this.map;
        let tes = [
          this.formLabelAlign.longitude,
          this.formLabelAlign.lattitude,
        ];
        map.setCenter(tes);
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
    },
    onSubmit(formName) {
      this.loading = true;
      // console.log(this.csrf);
      this.$refs[formName].validate((valid) => {
        if (valid) {
          axios
            .patch(
              `/update/${this.cctv.id}`,
              {
                name: this.formLabelAlign.name,
                category: this.formLabelAlign.category,
                address: this.formLabelAlign.address,
                lattitude: this.formLabelAlign.lattitude,
                longitude: this.formLabelAlign.longitude,
                agency: this.formLabelAlign.agency,
                url: this.formLabelAlign.url,
              },
              {
                headers: {
                  "Csrf-Token": this.csrf,
                },
              }
            )
            .then((response) => {
              console.log(response.data);
              this.$message({
                message: "New Data Added",
                type: "success",
              });
              this.loading = false;
              window.location.href = "/table";
            })
            .catch((error) => {
              this.$message({
                message: "Failed Adding Data",
                type: "error",
              });
              console.log(error);
              this.loading = false;
            });
        } else {
          this.$message({
            message: "Uncompleted",
            type: "error",
          });
          this.loading = false;
        }
      });
    },
  },

  mounted() {
    mapboxgl.accessToken = this.accessToken;
    var center = [this.cctv.longitude, this.cctv.lattitude];
    var map = new mapboxgl.Map({
      container: "map",
      style: "mapbox://styles/mapbox/streets-v11",
      center: center,
      minZoom: 2,
      zoom: 12,
      interactive: true,
    });
    this.map = map;

    var url = this.cctv.path_image;
    var popup = new mapboxgl.Popup({ closeOnClick: false, offset: 15 })
      .setLngLat(center)
      .setHTML(`<img class='popup-img' src='/storage/${url}'>`)
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
      console.log(coords.lat);
      console.log(coords.lng);
      this.formLabelAlign.lattitude = coords.lat;
      this.formLabelAlign.longitude = coords.lng;
      this.handleCoordinat('x');
      this.handleCoordinat('y');
    });
  },
};
</script>

<style>
.title-center-set-map {
  margin-bottom: 20px;
  font-size: var(--size-md);
  font-weight: 500;
}

.add-container {
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

.setting-form .el-input__inner,
.setting-form .el-select {
  width: 100%;
}

.el-input {
  font-size: var(--size-sm);
}

.add-container .el-form-item {
  width: 100%;
  margin-bottom: 10px;
  padding-right: 30px;
}

.btn-form-submit {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
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
/* 
.el-upload-list__item.is-success .el-upload-list__item-name:focus,
.el-upload-list__item.is-success .el-upload-list__item-name:hover {
  color: var(--green-theme);
  cursor: pointer;
}
a:hover {
  text-decoration: none;
} */

.avatar-uploader .el-upload {
  border: 1px dashed #d9d9d9;
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
}
.avatar-uploader .el-upload:hover {
  border-color: #409eff;
}
.avatar-uploader-icon {
  font-size: 28px;
  color: #8c939d;
  width: 178px;
  height: 178px;
  line-height: 178px;
  text-align: center;
}
.avatar {
  width: 178px;
  height: 178px;
  display: block;
}

@media screen and (max-width: 992px) {
  .el-form-item {
    width: 50%;
  }
}
@media screen and (max-width: 600px) {
  .add-container {
    padding-right: 10px;
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
