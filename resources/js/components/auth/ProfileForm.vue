<template>
  <div class="profile-page-container">
    <div class="profile-split-card">
      <div class="profile-form-panel">
        <h2 class="form-card-heading">Edit Profile</h2>

        <el-form
          ref="formLabelAlign"
          class="setting-form"
          label-position="top"
          :model="formLabelAlign"
          :rules="rules"
        >
          <el-form-item label="Name" prop="name">
            <el-input id="name" v-model="formLabelAlign.name" />
          </el-form-item>

          <el-form-item label="Address" prop="address">
            <el-input id="address" v-model="formLabelAlign.address" />
          </el-form-item>

          <div class="form-grid-two">
            <el-form-item label="Latitude (N)" prop="lattitude">
              <el-input id="lattitude" v-model="formLabelAlign.lattitude" />
            </el-form-item>

            <el-form-item label="Longitude (E)" prop="longitude">
              <el-input id="longitude" v-model="formLabelAlign.longitude" />
            </el-form-item>
          </div>

          <el-form-item label="Description" prop="description">
            <el-input id="description" v-model="formLabelAlign.description" type="textarea" />
          </el-form-item>

          <div class="btn-form-submit">
            <el-button type="info" @click="handleCancel">Discard</el-button>
            <el-button :loading="loading" type="primary" @click="onSubmit('formLabelAlign')">
              Update
            </el-button>
          </div>
        </el-form>
      </div>

      <div class="set-img-profiles">
        <img
          class="imgCont profilePhoto"
          :src="profileImageSrc"
          :alt="
            formLabelAlign.name
              ? `Profile photo for ${formLabelAlign.name}`
              : 'Agency profile photo'
          "
        />
        <div class="profile-photo-scrim" aria-hidden="true" />
        <el-upload
          class="upload-img-profile"
          :show-file-list="false"
          :auto-upload="false"
          action=""
          :on-change="onHandleUpload"
          :multiple="false"
        >
          <button type="button" class="profile-edit-photo-btn" aria-label="Change profile photo">
            <AppIcon name="pencil" :size="18" />
          </button>
        </el-upload>
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
.profile-split-card {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-card);
}

.profile-form-panel {
  padding: var(--space-6);
  min-width: 0;
}

.set-img-profiles {
  position: relative;
  min-height: 440px;
  border-left: 1px solid var(--border-subtle);
  background-color: var(--bg-surface-subtle);
  overflow: hidden;
}

.set-img-profiles .imgCont {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.55s ease;
}

.set-img-profiles:hover .imgCont {
  transform: scale(1.08);
}

.profile-photo-scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0) 55%, rgba(15, 23, 42, 0.55) 100%);
  pointer-events: none;
}

.upload-img-profile {
  position: absolute;
  bottom: 16px;
  right: 16px;
  z-index: 5;
}

.profile-edit-photo-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 2px solid var(--bg-surface);
  background-color: var(--accent-primary);
  color: var(--accent-on-fill);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: var(--shadow-float);
}

.profile-edit-photo-btn:hover {
  background-color: var(--accent-primary-hover);
}

@media screen and (max-width: 1023px) {
  .profile-split-card {
    grid-template-columns: 1fr;
  }

  .profile-form-panel {
    padding: var(--space-4);
  }

  .set-img-profiles {
    order: -1;
    min-height: 220px;
    max-height: 260px;
    border-left: 0;
    border-bottom: 1px solid var(--border-subtle);
  }
}
</style>
