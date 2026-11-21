<template>
  <div class="add-page-container">
    <div class="cctv-split-card">
      <div class="cctv-form-panel">
        <h2 class="form-card-heading">
          {{ isEdit ? "Edit CCTV" : "Add New CCTV" }}
        </h2>

        <el-form
          ref="formLabelAlign"
          class="setting-form"
          label-position="top"
          :model="formLabelAlign"
          :rules="rules"
        >
          <div class="form-grid-two">
            <el-form-item label="Name" prop="name">
              <el-input id="name" v-model="formLabelAlign.name" />
            </el-form-item>

            <el-form-item label="Category" prop="category">
              <el-select
                id="category"
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
          </div>

          <el-form-item label="Address" prop="address">
            <el-input id="address" v-model="formLabelAlign.address" />
          </el-form-item>

          <div class="form-grid-two">
            <el-form-item label="Latitude (N)" prop="lattitude">
              <el-input id="lattitude" v-model.number="formLabelAlign.lattitude" />
            </el-form-item>

            <el-form-item label="Longitude (E)" prop="longitude">
              <el-input id="longitude" v-model.number="formLabelAlign.longitude" />
            </el-form-item>
          </div>

          <div class="form-grid-two">
            <el-form-item label="Agency" prop="agency">
              <el-select id="agency" v-model="formLabelAlign.agency" placeholder="Select">
                <el-option
                  v-for="item in agenList"
                  :key="item.agenValue"
                  :label="item.label"
                  :value="item.agenValue"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="Image" prop="image">
              <el-upload
                :show-file-list="false"
                :auto-upload="false"
                action=""
                :on-change="onHandleUpload"
                :multiple="false"
              >
                <div class="upload-field-row">
                  <el-button type="primary">Click to upload</el-button>
                  <span v-if="imageUrl" class="upload-filename">{{ imageUrl }}</span>
                </div>
              </el-upload>
            </el-form-item>
          </div>

          <el-form-item label="Video URL" prop="url" :class="{ 'is-required': isUrlRequired }">
            <el-input
              id="url"
              v-model="formLabelAlign.url"
              placeholder="Contoh: /demo/videos/simpang-pdam.mp4 atau URL stream"
            />
            <div class="url-field-hint">
              {{
                isUrlRequired
                  ? "Wajib diisi untuk CCTV Analytic (digunakan untuk deteksi lalu lintas)."
                  : "Opsional untuk CCTV Regular (hanya pantauan; fallback ke thumbnail bila kosong atau error)."
              }}
            </div>
          </el-form-item>

          <div class="btn-form-submit">
            <el-button type="info" @click="handleCancel">Cancel</el-button>
            <el-button :loading="loading" type="primary" @click="onSubmit('formLabelAlign')">
              Submit
            </el-button>
          </div>
        </el-form>
      </div>

      <div class="cctv-map-panel" aria-label="Peta pemilih koordinat CCTV">
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
        url: [
          {
            validator: (_rule, value, callback) => {
              if (
                this.formLabelAlign.category === "Analytic" &&
                (!value || !String(value).trim())
              ) {
                callback(new Error("Video URL wajib diisi untuk kategori Analytic"));
                return;
              }
              callback();
            },
            trigger: "blur"
          }
        ]
      }
    };
  },
  computed: {
    isEdit() {
      return Boolean(this.cctv && this.cctv.id);
    },
    isUrlRequired() {
      return this.formLabelAlign.category === "Analytic";
    },
    previewPopupHtml() {
      if (this.previewObjectUrl) {
        return `<img class='popup-img' src='${escapeHtml(this.previewObjectUrl)}' alt='Pratinjau foto CCTV'>`;
      }
      if (this.isEdit && this.cctv.path_image) {
        return `<img class='popup-img' src='${escapeHtml(resolveCctvImagePath(this.cctv.path_image))}' alt='Foto CCTV terpilih'>`;
      }
      return "<div class='popup-empty-note'>Klik peta untuk memilih titik koordinat CCTV</div>";
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
    }
  },
  beforeDestroy() {
    if (this.previewObjectUrl) {
      URL.revokeObjectURL(this.previewObjectUrl);
    }
  },
  methods: {
    handleCategory() {
      if (
        this.$refs.formLabelAlign &&
        typeof this.$refs.formLabelAlign.clearValidate === "function"
      ) {
        this.$refs.formLabelAlign.clearValidate("url");
      }
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
.cctv-split-card {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-card);
}

.cctv-form-panel {
  padding: var(--space-6);
  min-width: 0;
}

.form-card-heading {
  margin: 0 0 var(--space-4);
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--text-primary);
}

.form-grid-two {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}

.upload-field-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.upload-filename {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  word-break: break-all;
}

.url-field-hint {
  margin-top: 6px;
  font-size: var(--text-caption);
  color: var(--text-muted);
  line-height: 1.4;
}

.btn-form-submit {
  margin-top: var(--space-4);
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.cctv-map-panel {
  position: relative;
  min-height: 460px;
  border-left: 1px solid var(--border-subtle);
  background-color: var(--bg-surface-subtle);
}

.popup-empty-note {
  font-size: var(--text-caption);
  font-weight: 600;
  color: var(--text-primary);
  padding: 4px 42px 4px 4px;
}

@media screen and (max-width: 1023px) {
  .cctv-split-card {
    grid-template-columns: 1fr;
  }

  .cctv-form-panel {
    padding: var(--space-4);
  }

  .cctv-map-panel {
    border-left: 0;
    border-top: 1px solid var(--border-subtle);
    min-height: 360px;
    height: 360px;
  }
}

@media screen and (max-width: 639px) {
  .form-grid-two {
    grid-template-columns: 1fr;
  }

  .btn-form-submit {
    justify-content: stretch;
  }

  .btn-form-submit .el-button {
    flex: 1;
    margin-left: 0 !important;
  }
}
</style>
