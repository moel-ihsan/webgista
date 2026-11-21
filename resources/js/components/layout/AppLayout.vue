<template>
  <div class="app-shell">
    <div class="topFix" aria-hidden="true" />
    <AppHeader
      :props-title="title"
      :menu-expanded="isMenuExpanded"
      @toggle-menu="handleMenuToggle"
    />
    <div class="app-workspace">
      <AppSidebar
        :desktop-expanded="desktopExpanded"
        :mobile-open="mobileNavOpen"
        @close-mobile="closeMobileNav"
      />
      <main id="main-content" class="app-main" :class="mainClass" :style="mainStyle" tabindex="-1">
        <SimulationBanner />
        <slot />
      </main>
    </div>
  </div>
</template>

<script>
import AppHeader from "./AppHeader.vue";
import AppSidebar from "./AppSidebar.vue";
import SimulationBanner from "./SimulationBanner.vue";

export default {
  name: "AppLayout",
  components: {
    AppHeader,
    AppSidebar,
    SimulationBanner
  },
  props: {
    title: {
      type: String,
      required: true
    },
    mainClass: {
      type: String,
      default: ""
    },
    mainStyle: {
      type: [String, Object],
      default: ""
    }
  },
  data() {
    return {
      desktopExpanded: false,
      mobileNavOpen: false
    };
  },
  computed: {
    isMenuExpanded() {
      if (typeof window !== "undefined" && window.innerWidth < 768) {
        return this.mobileNavOpen;
      }
      return this.desktopExpanded;
    }
  },
  mounted() {
    if (typeof window !== "undefined") {
      window.addEventListener("keydown", this.onGlobalKeydown);
    }
  },
  beforeDestroy() {
    if (typeof window !== "undefined") {
      window.removeEventListener("keydown", this.onGlobalKeydown);
    }
  },
  methods: {
    handleMenuToggle() {
      if (typeof window !== "undefined" && window.innerWidth < 768) {
        this.mobileNavOpen = !this.mobileNavOpen;
      } else {
        this.desktopExpanded = !this.desktopExpanded;
      }
    },
    closeMobileNav() {
      this.mobileNavOpen = false;
    },
    onGlobalKeydown(event) {
      if (event.key === "Escape" && this.mobileNavOpen) {
        this.mobileNavOpen = false;
      }
    }
  }
};
</script>

<style>
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-canvas);
  color: var(--text-primary);
}

.app-workspace {
  flex: 1;
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  padding: 0 var(--space-4) var(--space-4);
  min-width: 0;
}

.app-main {
  flex: 1;
  min-width: 0;
  width: 100%;
}

@media screen and (max-width: 767px) {
  .app-workspace {
    flex-direction: column;
    padding: 0 var(--space-3) var(--space-4);
    gap: var(--space-3);
  }
}
</style>
