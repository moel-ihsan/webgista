<template>
  <div>
    <div
      v-if="mobileOpen"
      class="sidebar-backdrop"
      aria-hidden="true"
      @click="$emit('close-mobile')"
    />

    <nav
      aria-label="Navigasi Utama"
      class="sidebar-nav"
      :class="{
        'sidebar-nav--expanded': desktopExpanded,
        'sidebar-nav--mobile-open': mobileOpen
      }"
    >
      <div class="sidebar-mobile-header">
        <span class="sidebar-brand">WebGIS</span>
        <button
          type="button"
          class="sidebar-close-btn"
          aria-label="Tutup menu navigasi"
          @click="$emit('close-mobile')"
        >
          <AppIcon name="close" :size="20" />
        </button>
      </div>

      <ul class="sidebar-list">
        <li v-for="item in navItems" :key="item.href" class="sidebar-item">
          <a
            :href="item.href"
            class="sidebar-link"
            :aria-current="isItemActive(item.id) ? 'page' : null"
            :aria-label="item.label"
            :title="!desktopExpanded && !mobileOpen ? item.label : ''"
            @click="$emit('close-mobile')"
          >
            <AppIcon :name="item.icon" :size="20" />
            <span class="sidebar-link-label">{{ item.label }}</span>
          </a>
        </li>
      </ul>
    </nav>
  </div>
</template>

<script>
import { fetchAuthUser } from "../../services/api/authApi";

export default {
  name: "AppSidebar",
  props: {
    desktopExpanded: {
      type: Boolean,
      default: false
    },
    mobileOpen: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      currentUrl: "",
      activeId: "dashboard",
      role: ""
    };
  },
  computed: {
    navItems() {
      const items = [
        { id: "dashboard", href: "/", icon: "home", label: "Dashboard" },
        { id: "map", href: "/map", icon: "map", label: "View Map" },
        { id: "table", href: "/table", icon: "list", label: "Data Table" }
      ];
      if (this.role === "admin") {
        items.push({ id: "settings", href: "/setting/1", icon: "settings", label: "Map Settings" });
      }
      return items;
    }
  },
  created() {
    this.loadAuthUser();
  },
  mounted() {
    const path = typeof window !== "undefined" ? window.location.pathname : "/";
    this.currentUrl = path;
    if (path === "/map") {
      this.activeId = "map";
    } else if (path.startsWith("/table") || path.startsWith("/detail")) {
      this.activeId = "table";
    } else if (path.startsWith("/setting")) {
      this.activeId = "settings";
    } else if (path.startsWith("/profile") || path.startsWith("/password")) {
      this.activeId = "";
    } else {
      this.activeId = "dashboard";
    }
  },
  methods: {
    loadAuthUser() {
      fetchAuthUser()
        .then((data) => {
          if (data && data.user) {
            this.role = data.user.role || "";
          }
        })
        .catch(() => {});
    },
    isItemActive(itemId) {
      return this.activeId === itemId;
    }
  }
};
</script>

<style>
.sidebar-backdrop {
  display: none;
}

.sidebar-nav {
  width: 68px;
  flex-shrink: 0;
  background: var(--bg-sidebar-gradient);
  border-radius: var(--radius-lg);
  padding: var(--space-3) var(--space-2);
  box-shadow: var(--shadow-float);
  transition:
    width 0.2s ease,
    transform 0.2s ease;
}

.sidebar-nav--expanded {
  width: 210px;
  padding: var(--space-3);
}

.sidebar-mobile-header {
  display: none;
}

.sidebar-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.sidebar-item {
  width: 100%;
}

.sidebar-link {
  width: 100%;
  min-height: 48px;
  padding: 0 14px;
  border-radius: var(--radius-md);
  color: var(--sidebar-item-text);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  font-size: var(--text-sm);
  font-weight: 600;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.sidebar-nav--expanded .sidebar-link {
  justify-content: flex-start;
}

.sidebar-link:hover {
  background-color: rgba(255, 255, 255, 0.18);
  color: var(--sidebar-item-text);
}

.sidebar-link[aria-current="page"] {
  background-color: var(--sidebar-active-bg);
  color: var(--sidebar-active-text);
  box-shadow: var(--shadow-card);
}

.sidebar-link-label {
  display: none;
  white-space: nowrap;
}

.sidebar-nav--expanded .sidebar-link-label {
  display: inline;
}

@media screen and (max-width: 767px) {
  .sidebar-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    background-color: rgba(15, 23, 42, 0.55);
    z-index: 80;
  }

  .sidebar-nav {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: 260px;
    border-radius: 0 var(--radius-lg) var(--radius-lg) 0;
    padding: var(--space-4);
    z-index: 90;
    transform: translateX(-110%);
    visibility: hidden;
  }

  .sidebar-nav--mobile-open {
    transform: translateX(0);
    visibility: visible;
  }

  .sidebar-mobile-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-4);
    padding-bottom: var(--space-3);
    border-bottom: 1px solid rgba(255, 255, 255, 0.22);
  }

  .sidebar-brand {
    font-size: var(--text-lg);
    font-weight: 700;
    color: #ffffff;
  }

  .sidebar-close-btn {
    width: 44px;
    height: 44px;
    border-radius: var(--radius-sm);
    border: 1px solid rgba(255, 255, 255, 0.35);
    background: rgba(255, 255, 255, 0.12);
    color: #ffffff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .sidebar-link {
    justify-content: flex-start;
  }

  .sidebar-link-label {
    display: inline;
  }
}
</style>
