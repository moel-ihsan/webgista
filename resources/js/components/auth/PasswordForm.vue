<template>
  <div class="password-page-container">
    <div class="password-split-card">
      <div class="password-form-panel">
        <h2 class="form-card-heading">Change Password</h2>

        <el-form
          ref="formLabelAlign"
          class="setting-form"
          label-position="top"
          :model="formLabelAlign"
          :rules="rules"
        >
          <el-form-item label="Current Password" prop="curPas">
            <el-input id="curPas" v-model="formLabelAlign.curPas" type="password" />
          </el-form-item>

          <el-form-item label="New Password" prop="newPas">
            <el-input id="newPas" v-model="formLabelAlign.newPas" type="password" />
          </el-form-item>

          <el-form-item label="Confirm New Password" prop="confirm">
            <el-input id="confirm" v-model="formLabelAlign.confirm" type="password" />
          </el-form-item>

          <div class="btn-form-submit">
            <el-button type="info" @click="handleCancel">Discard</el-button>
            <el-button :loading="loading" type="primary" @click="onSubmit('formLabelAlign')">
              Update
            </el-button>
          </div>
        </el-form>
      </div>

      <div class="set-img-profile">
        <img
          class="imgCont"
          :src="avatarSrc"
          alt="Ilustrasi akun dan kamera pengawas lalu lintas"
        />
      </div>
    </div>
  </div>
</template>

<script>
import { changePassword, fetchAuthUser } from "../../services/api/authApi";
import { resolveProfileImagePath } from "../../utils/formatters";

export default {
  name: "PasswordForm",
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
        curPas: "",
        newPas: "",
        confirm: ""
      },
      idUser: "",
      circleUrl: "",
      loading: false,
      rules: {
        curPas: [{ required: true, message: "Please input pas", trigger: "blur" }],
        newPas: [{ required: true, message: "Please input pas", trigger: "blur" }],
        confirm: [{ required: true, message: "Please input pas", trigger: "blur" }]
      }
    };
  },
  computed: {
    avatarSrc() {
      return resolveProfileImagePath(this.circleUrl);
    }
  },
  created() {
    this.loadCurrentUser();
  },
  methods: {
    handleCancel() {
      window.history.back();
    },
    loadCurrentUser() {
      fetchAuthUser()
        .then((res) => {
          if (res && res.user) {
            this.circleUrl = res.user.profile_photo_path || "";
            this.idUser = res.user.id;
          }
        })
        .catch(() => {});
    },
    onSubmit(formName) {
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

        if (this.formLabelAlign.newPas !== this.formLabelAlign.confirm) {
          this.$message({
            message: "New password and confirm password not match",
            type: "error"
          });
          this.loading = false;
          return;
        }

        changePassword(this.idUser, {
          curPas: this.formLabelAlign.curPas,
          newPas: this.formLabelAlign.newPas,
          confirm: this.formLabelAlign.confirm
        })
          .then((res) => {
            this.loading = false;
            if (res && res.status === 200) {
              this.$message({
                message: "New Password Updated",
                type: "success"
              });
              window.location.href = "/";
              return;
            }
            this.$message({
              message: "Current password not match",
              type: "error"
            });
          })
          .catch(() => {
            this.$message({
              message: "Failed update new password",
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
.password-split-card {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-card);
}

.password-form-panel {
  padding: var(--space-6);
  min-width: 0;
}

.set-img-profile {
  position: relative;
  min-height: 400px;
  border-left: 1px solid var(--border-subtle);
  background-color: var(--bg-surface-subtle);
  overflow: hidden;
}

.set-img-profile .imgCont {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

@media screen and (max-width: 1023px) {
  .password-split-card {
    grid-template-columns: 1fr;
  }

  .password-form-panel {
    padding: var(--space-4);
  }

  .set-img-profile {
    order: -1;
    min-height: 180px;
    max-height: 220px;
    border-left: 0;
    border-bottom: 1px solid var(--border-subtle);
  }
}
</style>
