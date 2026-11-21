<template>
  <div>
    <div class="profile-page-container">
      <div class="profile-container">
        <div class="title-center-set-map" style="margin-bottom: 20px">Edit Profile</div>
        <el-form
          ref="formLabelAlign"
          class="setting-form"
          :label-position="labelPosition"
          label-width="100px"
          :model="formLabelAlign"
          :rules="rules"
        >
          <el-row>
            <el-col :span="12" :xs="24">
              <el-form-item label="Name" prop="name">
                <el-input v-model="formLabelAlign.name" />
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
            <el-col :span="12" :xs="24">
              <el-form-item label="Lattitude (N)" prop="lattitude">
                <el-input v-model="formLabelAlign.lattitude" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row>
            <el-col :span="12" :xs="24">
              <el-form-item label="Longitude (E)" prop="longitude">
                <el-input v-model="formLabelAlign.longitude" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row>
            <el-col :span="12" :xs="24">
              <el-form-item label="Description" prop="description">
                <el-input v-model="formLabelAlign.description" type="textarea" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row>
            <el-col :span="12" :xs="24">
              <el-form-item>
                <div class="btn-form-submit">
                  <el-button type="info" @click="handleCancel">Discard</el-button>
                  <el-button :loading="loading" type="primary" @click="onSubmit('formLabelAlign')">
                    Update
                  </el-button>
                </div>
              </el-form-item>
            </el-col>
          </el-row>
          <div class="set-img-profiles">
            <el-upload
              :show-file-list="false"
              :auto-upload="false"
              action=""
              :on-change="onHandleUpload"
              :multiple="false"
            >
              <el-button
                class="upload-img-profile"
                type="info"
                style="padding: 10px; border-radius: 100px"
              >
                <ion-icon name="pencil" />
              </el-button>
              <span>{{ imageUrl }}</span>
            </el-upload>

            <img class="imgCont profilePhoto" :src="profileImageSrc" />
          </div>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script>
import { updateProfile, uploadProfilePhoto } from "../../services/api/authApi";
import { resolveProfileImagePath } from "../../utils/formatters";

export default {
  name: "ProfileForm",
  props: {
    users: {
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
      formLabelAlign: {
        name: "",
        address: "",
        lattitude: "",
        longitude: "",
        description: ""
      },
      rules: {
        name: [{ required: false, message: "Please input name", trigger: "blur" }],
        address: [{ required: false, message: "Please input address", trigger: "blur" }],
        lattitude: [{ required: false, message: "Input number", trigger: "blur" }],
        longitude: [{ required: false, message: "Input number", trigger: "blur" }],
        description: [{ required: false, message: "Please input description", trigger: "blur" }]
      },
      loading: false,
      imageUrl: "",
      previewObjectUrl: ""
    };
  },
  computed: {
    profileImageSrc() {
      if (this.previewObjectUrl) {
        return this.previewObjectUrl;
      }
      return resolveProfileImagePath(this.users && this.users.profile_photo_path);
    }
  },
  created() {
    if (this.users) {
      this.formLabelAlign.name = this.users.name || "";
      this.formLabelAlign.address = this.users.address || "";
      this.formLabelAlign.lattitude = this.users.lattitude || "";
      this.formLabelAlign.longitude = this.users.longitude || "";
      this.formLabelAlign.description = this.users.description || "";
      this.imageUrl = this.users.profile_photo_path || "";
    }
  },
  beforeDestroy() {
    if (this.previewObjectUrl) {
      URL.revokeObjectURL(this.previewObjectUrl);
    }
  },
  methods: {
    handleCancel() {
      window.history.back();
    },
    onHandleUpload(file) {
      if (!this.users || !this.users.id || !file || !file.raw) {
        return;
      }
      if (this.previewObjectUrl) {
        URL.revokeObjectURL(this.previewObjectUrl);
      }
      this.previewObjectUrl = URL.createObjectURL(file.raw);
      this.imageUrl = file.name;

      uploadProfilePhoto(this.users.id, file.raw).catch(() => {
        this.$message({
          message: "Failed Adding Data",
          type: "error"
        });
      });
    },
    onSubmit(formName) {
      if (!this.users || !this.users.id) {
        return;
      }
      this.loading = true;
      this.$refs[formName].validate((valid) => {
        if (!valid) {
          this.$message({
            message: "Uncompleted",
            type: "error"
          });
          this.loading = false;
          return;
        }

        updateProfile(this.users.id, {
          name: this.formLabelAlign.name,
          address: this.formLabelAlign.address,
          lattitude: this.formLabelAlign.lattitude,
          longitude: this.formLabelAlign.longitude,
          description: this.formLabelAlign.description
        })
          .then(() => {
            this.$message({
              message: "New Data Added",
              type: "success"
            });
            this.loading = false;
            window.location.href = "/";
          })
          .catch(() => {
            this.$message({
              message: "Failed Adding Data",
              type: "error"
            });
            this.loading = false;
          });
      });
    }
  }
};
</script>

<style>
.profile-container {
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
  font-size: 12px;
}

.profile-container .el-form-item {
  width: 100%;
  margin-bottom: 10px;
  padding-right: 30px;
}

.btn-form-submit {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.set-img-profiles {
  position: absolute;
  background: white;
  display: flex;
  align-items: center;
  border-radius: 10px;
  overflow: hidden;
  height: 100%;
  width: 50%;
  top: 0;
  right: 0;
  box-shadow: -10px 0 20px rgba(29, 29, 29, 0.2);
  -webkit-box-shadow: -10px 0 20px rgba(29, 29, 29, 0.2);
  -moz-box-shadow: -10px 0 20px rgba(29, 29, 29, 0.2);
  transition: all 0.5s ease;
}

.set-img-profiles:before {
  content: "";
  position: absolute;
  bottom: 0;
  left: 0;
  height: 20%;
  width: 100%;
  z-index: 1;
  background: linear-gradient(180deg, rgba(13, 13, 13, 0) 0%, rgba(7, 7, 7, 1) 100%);
  mix-blend-mode: multiply;
  transition: all 0.5s ease;
}

.set-img-profiles:hover:before {
  height: 60%;
}

.set-img-profiles .imgCont {
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  -o-object-fit: cover;
  object-fit: cover;
  position: absolute;
  transition: all 0.5s ease;
}

.mapboxgl-ctrl-attrib.mapboxgl-compact {
  display: none;
}

.el-textarea__inner:hover,
.el-textarea__inner:focus {
  border-color: var(--green-theme);
}

.el-textarea__inner {
  font-size: 12px;
  color: var(--text-color);
  background-color: var(--color-secondary);
  border: 1px solid var(--green-theme-30);
  border-radius: 10px;
  transition: border-color 0.2s cubic-bezier(0.645, 0.045, 0.355, 1);
}

.upload-img-profile {
  position: absolute;
  z-index: 10;
  bottom: 20px;
  right: 20px;
}

@media screen and (max-width: 600px) {
  .profile-container {
    padding-right: 10px;
  }

  .set-img-profiles {
    top: 102%;
    width: 100%;
    left: 0;
    box-shadow: 0px -10px 20px rgba(29, 29, 29, 0.2);
    -webkit-box-shadow: 0px -10px 20px rgba(29, 29, 29, 0.2);
    -moz-box-shadow: 0px -10px 20px rgba(29, 29, 29, 0.2);
  }
}
</style>
