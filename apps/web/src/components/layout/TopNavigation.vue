<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { authSession } from '../../auth/session'
import { accountPresentation } from '../../data/accountPresentation'
import AppIcon from '../ui/AppIcon.vue'

defineEmits<{ openNavigation: [] }>()
defineProps<{ navigationOpen: boolean }>()

const route = useRoute()
const title = computed(() => String(route.meta.title ?? 'WebGIS'))
const identityLabel = computed(
  () => authSession.state.displayName ?? authSession.state.user?.email ?? '',
)
const initials = computed(() => {
  const name = identityLabel.value.trim()
  return name ? name.slice(0, 1).toUpperCase() : 'U'
})
const darkTheme = ref(false)

function setTheme(dark: boolean): void {
  darkTheme.value = dark
  document.documentElement.dataset.theme = dark ? 'dark' : 'normal'
  localStorage.setItem('theme', dark ? 'theme-dark' : 'theme-normal')
}

function toggleTheme(): void {
  setTheme(!darkTheme.value)
}

onMounted(() => setTheme(localStorage.getItem('theme') === 'theme-dark'))
</script>

<template>
  <header class="topbar">
    <div class="topbar__title">
      <button
        class="topbar__menu"
        type="button"
        aria-label="Open navigation"
        aria-controls="primary-navigation"
        :aria-expanded="navigationOpen"
        @click="$emit('openNavigation')"
      >
        <AppIcon name="menu" />
      </button>
      <h1>{{ title }}</h1>
    </div>

    <div class="topbar__actions">
      <button
        class="theme-toggle"
        :class="{ 'theme-toggle--dark': darkTheme }"
        type="button"
        :aria-pressed="darkTheme"
        :aria-label="darkTheme ? 'Switch to light theme' : 'Switch to dark theme'"
        @click="toggleTheme"
      >
        <AppIcon :name="darkTheme ? 'moon' : 'sun'" :size="17" />
        <span class="theme-toggle__track" aria-hidden="true"><span></span></span>
      </button>

      <template v-if="authSession.state.status === 'authenticated'">
        <details class="account-menu">
          <summary class="topbar__user" :title="identityLabel" aria-label="Account menu">
            <img v-if="accountPresentation.photoUrl" class="topbar__avatar" :src="accountPresentation.photoUrl" alt="">
            <span v-else class="topbar__avatar" aria-hidden="true">{{ initials }}</span>
            <span class="topbar__identity">{{ identityLabel }}</span>
          </summary>
          <nav class="account-menu__items" aria-label="Account navigation">
            <RouterLink to="/profile"><AppIcon name="person" :size="18" />Edit Profile</RouterLink>
            <RouterLink to="/password"><AppIcon name="lock" :size="18" />Change Password</RouterLink>
          </nav>
        </details>
      </template>
      <RouterLink
        v-else-if="authSession.state.status !== 'loading'"
        class="topbar__login"
        to="/login"
      >
        Login
      </RouterLink>
    </div>
  </header>
</template>
