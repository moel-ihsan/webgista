<template>
  <header class="app-header">
    <div class="header-left">
      <button
        type="button"
        class="header-menu-btn"
        aria-label="Toggle navigation menu"
        :aria-expanded="menuExpanded ? 'true' : 'false'"
        @click="$emit('toggle-menu')"
      >
        <AppIcon :name="menuExpanded ? 'filter' : 'menu'" :size="20" />
      </button>
      <div class="header-title-group">
        <a href="/" class="header-brand-link" aria-label="WebGIS Home" title="WebGIS Home">
          <img src="/assets/brand/svg/webgis-icon.svg" alt="WebGIS" class="header-brand-icon" />
        </a>
        <span class="header-brand-divider" aria-hidden="true" />
        <h1 class="page-title">{{ resolvedTitle }}</h1>
      </div>
    </div>

    <div class="header-right">
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

      <a v-if="role !== 'admin'" href="/login" class="header-login-btn">Login</a>

      <div v-else ref="profileMenuWrap" class="profile-menu-wrap">
        <button
          type="button"
          class="avatar-menu-trigger"
          aria-haspopup="menu"
          :aria-expanded="profileMenuOpen ? 'true' : 'false'"
          aria-label="Admin account menu"
          @click="toggleProfileMenu"
        >
          <img
            :src="avatarSrc"
            :alt="userName ? `Profile photo for ${userName}` : 'Admin profile photo'"
            class="avatar-menu-img"
          />
        </button>

        <ul v-if="profileMenuOpen" class="profile-dropdown" role="menu" aria-label="Admin menu">
          <li role="none">
            <a :href="'/profile/' + id" class="profile-dropdown-link" role="menuitem">
              <AppIcon name="person-circle" :size="18" />
              <span>Edit Profile</span>
            </a>
          </li>
          <li role="none">
            <a href="/password" class="profile-dropdown-link" role="menuitem">
              <AppIcon name="key" :size="18" />
              <span>Change Password</span>
            </a>
          </li>
          <li role="none">
            <a
              href="/logout"
              class="profile-dropdown-link profile-dropdown-link--danger"
              role="menuitem"
            >
              <AppIcon name="log-out" :size="18" />
              <span>Log Out</span>
            </a>
          </li>
        </ul>
      </div>
    </div>
  </header>
</template>

<script>
import { fetchAuthUser } from "../../services/api/authApi";
import { isDarkTheme, subscribeTheme, toggleTheme } from "../../services/theme";
import { resolveProfileImagePath } from "../../utils/formatters";

export default {
  name: "AppHeader",
  props: {
    propsTitle: {
      type: String,
      required: true
    },
    menuExpanded: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      circleUrl: "",
      userName: "",
      role: "",
      id: "",
      isDark: isDarkTheme(),
      profileMenuOpen: false,
      unsubscribeTheme: null
    };
  },
  computed: {
    resolvedTitle() {
      return this.propsTitle || "WebGIS";
    },
    avatarSrc() {
      return resolveProfileImagePath(this.circleUrl);
    }
  },
  created() {
    this.loadAuthUser();
  },
  mounted() {
    this.isDark = isDarkTheme();
    this.unsubscribeTheme = subscribeTheme(({ isDark }) => {
      this.isDark = isDark;
    });
    if (typeof document !== "undefined") {
      document.addEventListener("click", this.handleOutsideClick);
      document.addEventListener("keydown", this.handleEscapeKey);
    }
  },
  beforeDestroy() {
    if (typeof this.unsubscribeTheme === "function") {
      this.unsubscribeTheme();
    }
    if (typeof document !== "undefined") {
      document.removeEventListener("click", this.handleOutsideClick);
      document.removeEventListener("keydown", this.handleEscapeKey);
    }
  },
  methods: {
    loadAuthUser() {
      fetchAuthUser()
        .then((data) => {
          if (data && data.user) {
            this.circleUrl = data.user.profile_photo_path || "";
            this.userName = data.user.name || "";
            this.role = data.user.role || "";
            this.id = data.user.id || "";
          }
        })
        .catch(() => {});
    },
    onToggleTheme() {
      const next = toggleTheme();
      this.isDark = next === "theme-dark";
    },
    toggleProfileMenu() {
      this.profileMenuOpen = !this.profileMenuOpen;
    },
    handleOutsideClick(event) {
      const wrap = this.$refs.profileMenuWrap;
      if (this.profileMenuOpen && wrap && !wrap.contains(event.target)) {
        this.profileMenuOpen = false;
      }
    },
    handleEscapeKey(event) {
      if (event.key === "Escape" && this.profileMenuOpen) {
        this.profileMenuOpen = false;
      }
    }
  }
};
</script>

<style>
.app-header {
  min-height: 64px;
  padding: var(--space-2) var(--space-4);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  background-color: var(--bg-canvas);
  color: var(--text-primary);
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
  flex: 1;
}

.header-menu-btn {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  background-color: var(--bg-surface);
  color: var(--text-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  box-shadow: var(--shadow-card);
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.header-menu-btn:hover {
  background-color: var(--bg-surface-subtle);
  border-color: var(--accent-primary);
}

@media screen and (min-width: 768px) {
  .header-left {
    gap: var(--space-4);
  }

  /* Center 44px toggle button inside 68px collapsed sidebar track so page title aligns with main content */
  .header-menu-btn {
    margin-inline: 12px;
  }
}

.header-title-group {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.header-brand-link {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform 0.15s ease;
}

.header-brand-link:hover {
  transform: scale(1.06);
}

.header-brand-icon {
  width: 30px;
  height: 30px;
  display: block;
  object-fit: contain;
}

.header-brand-divider {
  width: 1px;
  height: 20px;
  background-color: var(--border-subtle);
  flex-shrink: 0;
}

.page-title {
  margin: 0;
  font-size: var(--text-xl);
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.015em;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-shrink: 0;
}

.theme-switch-btn {
  width: 60px;
  height: 44px;
  padding: 0 5px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-input);
  background-color: var(--bg-surface);
  color: var(--text-primary);
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  cursor: pointer;
  box-shadow: var(--shadow-card);
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;
}

.theme-switch-btn:hover {
  border-color: var(--accent-primary);
}

html.theme-dark .theme-switch-btn {
  justify-content: flex-end;
}

.theme-switch-thumb {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background-color: var(--accent-primary);
  color: var(--accent-on-fill);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.header-login-btn {
  min-height: 44px;
  padding: 0 var(--space-4);
  border-radius: var(--radius-sm);
  background-color: var(--accent-primary);
  color: var(--accent-on-fill);
  font-size: var(--text-sm);
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-card);
  transition:
    background-color 0.15s ease,
    transform 0.15s ease;
}

.header-login-btn:hover {
  background-color: var(--accent-primary-hover);
  color: var(--accent-on-fill);
}

.profile-menu-wrap {
  position: relative;
}

.avatar-menu-trigger {
  width: 44px;
  height: 44px;
  padding: 2px;
  border-radius: 50%;
  border: 2px solid var(--accent-primary);
  background-color: var(--bg-surface);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  box-shadow: var(--shadow-card);
}

.avatar-menu-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.profile-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 210px;
  margin: 0;
  padding: var(--space-2);
  list-style: none;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-float);
  z-index: 60;
}

.profile-dropdown-link {
  min-height: 44px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-primary);
}

.profile-dropdown-link:hover {
  background-color: var(--bg-surface-subtle);
  color: var(--accent-primary);
}

.profile-dropdown-link--danger:hover {
  color: var(--danger-text);
  background-color: var(--danger-soft-bg);
}

@media screen and (max-width: 767px) {
  .app-header {
    padding: var(--space-2) var(--space-3);
  }

  .header-title-group {
    gap: 8px;
  }

  .header-brand-link {
    width: 28px;
    height: 28px;
  }

  .header-brand-icon {
    width: 26px;
    height: 26px;
  }

  .page-title {
    font-size: 1.125rem;
  }
}
</style>
