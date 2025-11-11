<template>
  <div>
    <div class="password-page-container">
      <div class="password-container">
        <div class="title-center-set-map" style="margin-bottom: 20px">
          Change Password
        </div>
        <!-- <el-col :span="12" :xs="24"> -->
        <el-form
          class="setting-form"
          :label-position="labelPosition"
          label-width="100px"
          :model="formLabelAlign"
          :rules="rules"
          ref="formLabelAlign"
        >
          <el-row>
            <el-col :span="12" :xs="24">
              <el-form-item label="Current Password" prop="curPas">
                <el-input
                  v-model="formLabelAlign.curPas"
                  type="password"
                ></el-input>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row>
            <el-col :span="12" :xs="24">
              <el-form-item label="New Password" prop="newPas">
                <el-input
                  v-model="formLabelAlign.newPas"
                  type="password"
                ></el-input>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row>
            <el-col :span="12" :xs="24">
              <el-form-item label="Confirm New Password" prop="confirm">
                <el-input
                  v-model="formLabelAlign.confirm"
                  type="password"
                ></el-input>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row>
            <el-col :span="12" :xs="24">
              <el-form-item>
                <div class="btn-form-submit">
                  <el-button type="info" @click="handleCancel"
                    >Discard</el-button
                  >
                  <el-button
                    :loading="loading"
                    type="primary"
                    @click="onSubmit('formLabelAlign')"
                    >Update</el-button
                  >
                </div>
              </el-form-item>
            </el-col>
          </el-row>
        </el-form>
        <div class="set-img-profile">
          <img class="imgCont" :src="'/storage/' + circleUrl" />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    users: { type: Object },
    csrf: { type: String },
  },
  name: "set-img-profile",
  data() {
    return {
      labelPosition: "top",
      formLabelAlign: {
        curPas: "",
        newPas: "",
        confirm: "",
      },
      idUser: "",
      rules: {
        curPas: [
          {
            required: true,
            message: "Please input pas",
            trigger: "blur",
          },
        ],
        newPas: [
          {
            required: true,
            message: "Please input pas",
            trigger: "blur",
          },
        ],
        confirm: [
          {
            required: true,
            message: "Please input pas",
            trigger: "blur",
          },
        ],
      },
      circleUrl: "",
    };
  },
  created() {
    this.fetchUser();
  },
  methods: {
    handleCancel() {
      window.history.back();
    },
    onSubmit(formName) {
      this.loading = true;
      this.$refs[formName].validate((valid) => {
         if (valid) {
          if (this.formLabelAlign.newPas != this.formLabelAlign.confirm) {
            this.$message({
              message: "New password and confirm password not match",
              type: "error",
            });
            this.loading = false;
            return;
          }
          axios
            .post(
              `/changePassword/${this.idUser}`,
              {
                curPas: this.formLabelAlign.curPas,
                newPas: this.formLabelAlign.newPas,
                confirm: this.formLabelAlign.confirm,
              },
              {
                headers: {
                  "Csrf-Token": this.csrf,
                },
              }
            )
            .then((response) => {
              console.log("masuk");
              console.log(response.data);
              this.loading = false;
              console.log(response.data);
              if (response.data.status === 200) {
                this.$message({
                  message: "New Password Updated",
                  type: "success",
                });
                window.location.href = "/";
              } else
                this.$message({
                  message: "Current password not match",
                  type: "error",
                });
            })
            .catch((error) => {
              this.$message({
                message: "Failed update new password",
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
    fetchUser() {
      axios
        .get("/authUser")
        .then((res) => {
          this.circleUrl = res.data.user.profile_photo_path;
          this.idUser = res.data.user.id;
        })
        .catch((err) => console.log(err));
    },
    handleAvatarSuccess(res, file) {
      this.imageUrl = URL.createObjectURL(file.raw);
    },
    beforeAvatarUpload(file) {
      const isJPG = file.type === "image/jpeg";
      const isLt2M = file.size / 1024 / 1024 < 2;

      if (!isJPG) {
        this.$message.error("Avatar picture must be JPG format!");
      }
      if (!isLt2M) {
        this.$message.error("Avatar picture size can not exceed 2MB!");
      }
      return isJPG && isLt2M;
    },
  },

  mounted() {},
};
</script>

<style>
.password-container {
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

.password-container .el-form-item {
  width: 100%;
  margin-bottom: 10px;
  padding-right: 30px;
}

.btn-form-submit {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.set-img-profile {
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

.set-img-profile .imgCont {
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  -o-object-fit: cover;
  object-fit: cover;
  position: absolute;
  transition: all 0.5s ease;
}

.set-img-profile:hover .imgCont {
  transform: scale(1.25);
}

.mapboxgl-ctrl-attrib.mapboxgl-compact {
  display: none;
}

@media screen and (max-width: 992px) {
  .el-form-item {
    width: 50%;
  }
}
@media screen and (max-width: 600px) {
  .password-container {
    padding-right: 10px;
  }

  .set-img-profile {
    top: 102%;
    width: 100%;
    left: 0;
    box-shadow: 0px -10px 20px rgba(29, 29, 29, 0.2);
    -webkit-box-shadow: 0px -10px 20px rgba(29, 29, 29, 0.2);
    -moz-box-shadow: 0px -10px 20px rgba(29, 29, 29, 0.2);
  }
}
</style>
