<template>
  <div>
    <div class="login-page-container" style="overflow: hidden">
      <div class="login-container">
        <el-row>
          <el-col :span="12" :xs="24">
            <div class="form-content">
              <div class="webgis">Web<span>GIS</span></div>
              <el-form
                class="register-form"
                :label-position="labelPosition"
                label-width="100px"
                :model="formLabelAlign"
              >
                <el-row>
                  <el-col :span="24">
                    <el-form-item>
                      <el-input
                        v-model="formLabelAlign.email"
                        type="email"
                        placeholder="Your Email"
                        @keyup.enter.native="onSubmit"
                      />
                    </el-form-item>
                  </el-col>
                </el-row>
                <el-row>
                  <el-col :span="24">
                    <el-form-item>
                      <el-input
                        v-model="formLabelAlign.pass"
                        type="password"
                        placeholder="Your Password"
                        @keyup.enter.native="onSubmit"
                      />
                    </el-form-item>
                  </el-col>
                </el-row>
                <el-row>
                  <el-col :span="24">
                    <el-form-item>
                      <div class="btn-form-submit back-btn">
                        <el-button type="primary" @click="onSubmit">Sign In</el-button>
                      </div>
                      <a href="/">
                        <div class="forgot-password">Back to Dashboard</div>
                      </a>
                    </el-form-item>
                  </el-col>
                </el-row>
              </el-form>
            </div>
          </el-col>
        </el-row>
        <div class="set-img-profile">
          <img class="imgCont" src="/assets/tf5.jpg" />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { login } from "../../services/api/authApi";

export default {
  name: "LoginForm",
  props: {
    csrf: {
      type: String,
      default: ""
    }
  },
  data() {
    return {
      labelPosition: "top",
      formLabelAlign: {
        email: "",
        pass: ""
      }
    };
  },
  methods: {
    onSubmit() {
      login({
        email: this.formLabelAlign.email,
        password: this.formLabelAlign.pass
      })
        .then((res) => {
          if (res && res.isAuth) {
            this.$message({
              message: "Welcome!",
              type: "success"
            });
            window.location.href = "/";
            return;
          }
          this.$message({
            message: "Wrong email or password!",
            type: "error"
          });
        })
        .catch(() => {
          this.$message({
            message: "Wrong email or password!",
            type: "error"
          });
        });
    }
  }
};
</script>

<style>
.login-container {
  left: 50%;
  transform: translateX(-50%);
  position: relative;
  width: 80%;
  background-color: var(--color-secondary);
  border-radius: 10px;
  box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
  -webkit-box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
  -moz-box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
}

.login-container .form-content {
  padding: 80px 50px;
  padding-left: 80px;
}

.webgis {
  margin-bottom: 30px;
  font-size: var(--size-xl);
  font-weight: 400;
  text-align: center;
  padding-right: 30px;
  color: var(--text-color);
}

.webgis span {
  color: var(--green-theme);
  font-weight: 700;
  font-size: var(--size-lg);
}

.forgot-password,
.register {
  text-align: center;
  color: var(--text-color);
}

.forgot-password {
  margin-top: 10px;
}

.register {
  margin-top: -10px;
}

.register-form .el-input__inner {
  margin-bottom: 10px;
}

.register-form .el-input__inner,
.register-form .el-select {
  width: 100%;
}

.login-container .el-form-item {
  width: 100%;
  margin-bottom: 10px;
  padding-right: 30px;
}

.login-container .el-input__inner {
  width: 100%;
  height: 40px;
}

.btn-form-submit {
  margin-top: 20px;
  display: flex-end;
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

@media screen and (max-width: 600px) {
  .login-container .el-form-item {
    width: 100%;
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
