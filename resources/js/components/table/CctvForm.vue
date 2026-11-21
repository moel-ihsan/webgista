<template>
  <div>
    <div class="add-page-container">
      <div class="add-container">
        <div class="title-center-set-map">
          {{ isEdit ? "Edit New CCTV" : "Add New CCTV" }}
        </div>

        <el-form
          ref="formLabelAlign"
          class="setting-form"
          :label-position="labelPosition"
          label-width="100px"
          :model="formLabelAlign"
          :rules="rules"
        >
          <el-row>
            <el-col :span="6" :xs="24">
              <el-form-item label="Name" prop="name">
                <el-input v-model="formLabelAlign.name" />
              </el-form-item>
            </el-col>
            <el-col :span="6" :xs="24">
              <el-form-item label="Category" prop="category">
                <el-select
                  v-model="formLabelAlign.category"
                  placeholder="Select"
                  @change="handleCategory"
                >
                  <el-option
                    v-for="item in catList"
                    :key="item.catValue"
                    :label="item.label"
                    :value="item.catValue"
                  />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row>
            <el-col :span="12" :xs="24">
              <el-form-item label="Address" prop="address">
                <el-input v-model="formLabelAlign.address" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row>
            <el-col :span="6" :xs="24">
              <el-form-item label="Lattitude (N)" prop="lattitude">
                <el-input id="lat" v-model.number="formLabelAlign.lattitude" />
              </el-form-item>
            </el-col>
            <el-col :span="6" :xs="24">
              <el-form-item label="Longitude (E)" prop="longitude">
                <el-input id="long" v-model.number="formLabelAlign.longitude" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row>
            <el-col :span="6" :xs="24">
              <el-form-item label="Agency" prop="agency">
                <el-select v-model="formLabelAlign.agency" placeholder="Select">
                  <el-option
                    v-for="item in agenList"
                    :key="item.agenValue"
                    :label="item.label"
                    :value="item.agenValue"
                  />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="6" :xs="24">
              <el-form-item label="Image" prop="image">
                <el-upload
                  :show-file-list="false"
                  :auto-upload="false"
                  action=""
                  :on-change="onHandleUpload"
                  :multiple="false"
                >
                  <el-button size="small" type="primary">Click to upload</el-button>
                  <span>{{ imageUrl }}</span>
                </el-upload>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row v-if="showUrl">
            <el-col :span="12" :xs="24">
              <el-form-item label="URL" prop="url">
                <el-input v-model="formLabelAlign.url" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row>
            <el-col :span="12" :xs="24">
              <el-form-item>
                <div class="btn-form-submit">
                  <el-button type="info" @click="handleCancel">Cancel</el-button>
                  <el-button :loading="loading" type="primary" @click="onSubmit('formLabelAlign')">
                    Submit
                  </el-button>
                </div>
              </el-form-item>
            </el-col>
          </el-row>
        </el-form>
        <div class="set-map-container">
          <CoordinatePickerMap
            :latitude="formLabelAlign.lattitude || defaultCenter[1]"
            :longitude="formLabelAlign.longitude || defaultCenter[0]"
            :zoom="12"
            :selectable="true"
            :popup-html="previewPopupHtml"
            @select-coordinate="onMapCoordinateSelected"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import CoordinatePickerMap from "../map/CoordinatePickerMap.vue";
import { DEFAULT_MAP_CENTER } from "../../config/map";
import { fetchAll as fetchAgencies } from "../../services/api/agencyApi";
import {
  create as createCctv,
  update as updateCctv,
  uploadEditImage,
  uploadTempImage
} from "../../services/api/cctvApi";
import { escapeHtml, resolveCctvImagePath } from "../../utils/formatters";

export default {
  name: "CctvForm",
  components: {
    CoordinatePickerMap
  },
  props: {
    cctv: {
      type: Object,
      default: null
    }
  },
  data() {
    return {
      labelPosition: "top",
      defaultCenter: DEFAULT_MAP_CENTER,
      formLabelAlign: {
        name: "",
        category: "",
        address: "",
        lattitude: "",
        longitude: "",
        agency: "",
        url: ""
      },
      showUrl: false,
      imageUrl: "",
      previewObjectUrl: "",
      catList: [
        { catValue: "Regular", label: "Regular" },
        { catValue: "Analytic", label: "Analytic" }
      ],
      agenList: [],
      loading: false,
      rules: {
        name: [{ required: true, message: "Please input name", trigger: "blur" }],
        category: [{ required: true, message: "Please input category", trigger: "blur" }],
        address: [{ required: true, message: "Please input address", trigger: "blur" }],
        lattitude: [{ required: true, type: "number", message: "Input number", trigger: "blur" }],
        longitude: [{ required: true, type: "number", message: "Input number", trigger: "blur" }],
        agency: [{ required: true, message: "Please input agency", trigger: "blur" }],
        url: [{ required: false, message: "Please input url", trigger: "blur" }]
      }
    };
  },
  computed: {
    isEdit() {
      return Boolean(this.cctv && this.cctv.id);
    },
    previewPopupHtml() {
      if (this.previewObjectUrl) {
        return `<img class='popup-img' src='${escapeHtml(this.previewObjectUrl)}'>`;
      }
      if (this.isEdit && this.cctv.path_image) {
        return `<img class='popup-img' src='${escapeHtml(resolveCctvImagePath(this.cctv.path_image))}'>`;
      }
      return "<img class='popup-img' src='/assets/tmp.png'>";
    }
  },
  created() {
    this.loadAgencies();
    if (this.isEdit) {
      this.formLabelAlign.name = this.cctv.name;
      this.formLabelAlign.category = this.cctv.category;
      this.formLabelAlign.address = this.cctv.address;
      this.formLabelAlign.lattitude = Number(this.cctv.lattitude);
      this.formLabelAlign.longitude = Number(this.cctv.longitude);
      this.formLabelAlign.agency = this.cctv.agency;
      this.formLabelAlign.url = this.cctv.url || "";
      this.imageUrl = this.cctv.path_image || "";
      this.showUrl = this.cctv.category === "Analytic";
    }
  },
  beforeDestroy() {
    if (this.previewObjectUrl) {
      URL.revokeObjectURL(this.previewObjectUrl);
    }
  },
  methods: {
    handleCategory(value) {
      this.showUrl = value === "Analytic";
    },
    loadAgencies() {
      fetchAgencies()
        .then((rows) => {
          this.agenList = rows.map((row) => ({
            agenValue: row.agency,
            label: row.agency
          }));
        })
        .catch(() => {});
    },
    handleCancel() {
      window.history.back();
    },
    onMapCoordinateSelected({ latitude, longitude }) {
      this.formLabelAlign.lattitude = latitude;
      this.formLabelAlign.longitude = longitude;
    },
    onHandleUpload(file) {
      if (this.previewObjectUrl) {
        URL.revokeObjectURL(this.previewObjectUrl);
      }
      this.previewObjectUrl = URL.createObjectURL(file.raw);
      this.imageUrl = file.name;

      const request = this.isEdit
        ? uploadEditImage(this.cctv.id, file.raw)
        : uploadTempImage(file.raw);

      request.catch(() => {
        this.$message({ message: "Failed Adding Data", type: "error" });
      });
    },
    onSubmit(formName) {
      this.loading = true;
      this.$refs[formName].validate((valid) => {
        if (!valid) {
          this.$message({ message: "Uncompleted", type: "error" });
          this.loading = false;
          return;
        }

        const payload = {
          name: this.formLabelAlign.name,
          category: this.formLabelAlign.category,
          address: this.formLabelAlign.address,
          lattitude: this.formLabelAlign.lattitude,
          longitude: this.formLabelAlign.longitude,
          agency: this.formLabelAlign.agency,
          url: this.formLabelAlign.url || null
        };

        const request = this.isEdit ? updateCctv(this.cctv.id, payload) : createCctv(payload);

        request
          .then(() => {
            this.$message({ message: "New Data Added", type: "success" });
            this.loading = false;
            window.location.href = "/table";
          })
          .catch(() => {
            this.$message({ message: "Failed Adding Data", type: "error" });
            this.loading = false;
          });
      });
    }
  }
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
