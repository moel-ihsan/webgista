<template>
  <div class="login-page-shell">
    <div class="topFix" aria-hidden="true" />
    <header class="login-page-header">
      <button
        type="button"
        class="theme-switch-btn"
        role="switch"
        :aria-checked="isDark ? 'true' : 'false'"
        :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
        @click="onToggleTheme"
      >
        <span class="theme-switch-thumb" aria-hidden="true">
          <AppIcon :name="isDark ? 'moon' : 'sun'" :size="16" />
        </span>
      </button>
    </header>
    <main class="login-page-main">
      <LoginForm :csrf="csrf" />
    </main>
  </div>
</template>

<script>
import LoginForm from "../components/auth/LoginForm.vue";
import { isDarkTheme, subscribeTheme, toggleTheme } from "../services/theme";

export default {
  name: "LoginPage",
  components: {
    LoginForm
  },
  props: {
    csrf: {
      type: String,
      default: ""
    }
  },
  data() {
    return {
      isDark: isDarkTheme(),
      unsubscribeTheme: null
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
    onToggleTheme() {
      const next = toggleTheme();
      this.isDark = next === "theme-dark";
    }
  }
};
</script>

<style>
.login-page-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-canvas);
  color: var(--text-primary);
}

.login-page-header {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: var(--space-4) var(--space-5);
}

.login-page-main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 var(--space-4) var(--space-6);
}
</style>
