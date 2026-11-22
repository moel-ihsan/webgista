<template>
  <div class="login-page-container">
    <div class="login-container">
      <div class="form-content">
        <a href="/" class="login-brand-wrap" aria-label="WebGIS Traffic Condition">
          <img
            :src="
              isDark
                ? '/assets/brand/svg/webgis-logo-dark.svg'
                : '/assets/brand/svg/webgis-logo.svg'
            "
            alt="WebGIS Traffic Condition"
            class="login-brand-logo"
          />
        </a>
        <h1 class="sr-only">Sign In — WebGIS Traffic Condition</h1>
        <el-form
          class="register-form"
          label-position="top"
          :model="formLabelAlign"
          @submit.native.prevent="onSubmit"
        >
          <el-form-item>
            <label for="login-email" class="login-field-label">Email</label>
            <el-input
              id="login-email"
              v-model="formLabelAlign.email"
              type="email"
              placeholder="Your Email"
              autocomplete="email"
              @keyup.enter.native="onSubmit"
            />
          </el-form-item>

          <el-form-item>
            <label for="login-password" class="login-field-label">Password</label>
            <el-input
              id="login-password"
              v-model="formLabelAlign.pass"
              type="password"
              placeholder="Your Password"
              autocomplete="current-password"
              @keyup.enter.native="onSubmit"
            />
          </el-form-item>

          <div class="login-actions">
            <el-button
              :loading="submitting"
              type="primary"
              class="login-submit-btn"
              @click="onSubmit"
            >
              Sign In
            </el-button>
            <a href="/" class="forgot-password">Back to Dashboard</a>
          </div>
        </el-form>
      </div>

      <div class="set-img-profile">
        <img
          class="imgCont"
          src="/assets/tf5.jpg"
          alt="Traffic intersection monitoring illustration"
        />
      </div>
    </div>
  </div>
</template>

<script>
import { login } from "../../services/api/authApi";
import { isDarkTheme, subscribeTheme } from "../../services/theme";

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
      submitting: false,
      isDark: isDarkTheme(),
      unsubscribeTheme: null,
      formLabelAlign: {
        email: "",
        pass: ""
      }
    };
  },
  mounted() {
    this.isDark = isDarkTheme();
    this.unsubscribeTheme = subscribeTheme(({ isDark }) => {
      this.isDark = isDark;
    });
  },
  beforeDestroy() {
    if (typeof this.unsubscribeTheme === "function") {
      this.unsubscribeTheme();
    }
  },
  methods: {
    onSubmit() {
      if (this.submitting) {
        return;
      }
      this.submitting = true;
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
        })
        .finally(() => {
          this.submitting = false;
        });
    }
  }
};
</script>

<style>
.login-page-container {
  width: 100%;
  max-width: 980px;
}

.login-container {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-float);
}

.login-container .form-content {
  padding: 48px 40px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.login-brand-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 24px;
  border-radius: var(--radius-sm);
}

.login-brand-logo {
  height: 54px;
  width: auto;
  display: block;
  object-fit: contain;
}

.login-field-label {
  display: block;
  margin-bottom: 6px;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-secondary);
  line-height: 1.4;
}

.login-actions {
  margin-top: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  align-items: stretch;
}

.login-submit-btn {
  width: 100%;
  min-height: 44px;
}

.forgot-password {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--accent-primary);
  text-decoration: underline;
  border-radius: var(--radius-sm);
}

.set-img-profile {
  position: relative;
  min-height: 420px;
  overflow: hidden;
  background-color: var(--bg-surface-subtle);
}

.set-img-profile .imgCont {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.55s ease;
}

.set-img-profile:hover .imgCont {
  transform: scale(1.08);
}

@media screen and (max-width: 767px) {
  .login-container {
    grid-template-columns: 1fr;
  }

  .set-img-profile {
    order: -1;
    min-height: 150px;
    max-height: 170px;
  }

  .login-container .form-content {
    padding: 28px 20px;
  }
}
</style>
