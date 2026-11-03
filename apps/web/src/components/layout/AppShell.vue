<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'

import SidebarNavigation from './SidebarNavigation.vue'
import TopNavigation from './TopNavigation.vue'

const route = useRoute()
const mobileNavigationOpen = ref(false)

watch(
  () => route.fullPath,
  () => {
    mobileNavigationOpen.value = false
  },
)
</script>

<template>
  <a class="skip-link" href="#main-content">Skip to content</a>

  <div class="app-shell">
    <SidebarNavigation
      :open="mobileNavigationOpen"
      @close="mobileNavigationOpen = false"
    />

    <div class="app-frame">
      <TopNavigation
        :navigation-open="mobileNavigationOpen"
        @open-navigation="mobileNavigationOpen = true"
      />

      <main id="main-content" class="page-content" tabindex="-1">
        <RouterView v-slot="{ Component }">
          <Transition name="page" mode="out-in">
            <component :is="Component" />
          </Transition>
        </RouterView>
      </main>
    </div>
  </div>
</template>
