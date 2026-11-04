<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'

import { authSession } from '../../auth/session'
import SidebarNavigation from './SidebarNavigation.vue'
import TopNavigation from './TopNavigation.vue'

const route = useRoute()
const router = useRouter()
const sidebarCollapsed = ref(true)
const mobileNavigationOpen = ref(false)

watch(
  () => route.fullPath,
  () => {
    mobileNavigationOpen.value = false
  },
)

watch(
  () => [authSession.state.status, authSession.state.role] as const,
  ([status]) => {
    if (!route.meta.requiresAuth) return

    if (status === 'anonymous' || status === 'error' || status === 'unconfigured') {
      void router.replace({ name: 'login', query: { redirect: route.fullPath } })
    } else if (status === 'authenticated' && !authSession.canAccess(route.meta.roles)) {
      void router.replace({ name: 'access-denied' })
    }
  },
)

async function logout(): Promise<void> {
  if (await authSession.logout()) await router.replace('/')
}
</script>

<template>
  <a class="skip-link" href="#main-content">Skip to content</a>
  <div class="top-fix" aria-hidden="true"></div>

  <div v-if="route.name === 'login'" class="login-frame">
    <RouterView />
  </div>

  <div
    v-else
    class="app-layout"
    :class="{ 'app-layout--expanded': !sidebarCollapsed }"
  >
    <SidebarNavigation
      :collapsed="sidebarCollapsed"
      :open="mobileNavigationOpen"
      @close="mobileNavigationOpen = false"
      @toggle="sidebarCollapsed = !sidebarCollapsed"
      @logout="logout"
    />

    <div class="app-frame">
      <TopNavigation
        :navigation-open="mobileNavigationOpen"
        @open-navigation="mobileNavigationOpen = true"
      />

      <div v-if="authSession.state.status === 'loading'" class="auth-progress" role="status">
        Verifying session…
      </div>

      <main id="main-content" class="page-content" :class="{ 'page-content--map': route.name === 'map' }" tabindex="-1">
        <p v-if="route.meta.requiresAuth && authSession.state.status === 'loading'" role="status">
          Verifying access…
        </p>
        <RouterView v-else />
      </main>
    </div>
  </div>
</template>
