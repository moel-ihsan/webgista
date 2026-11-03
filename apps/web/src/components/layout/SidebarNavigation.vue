<script setup lang="ts">
import { RouterLink } from 'vue-router'

import { appConfig } from '../../config/app'

defineProps<{ open: boolean }>()
defineEmits<{ close: [] }>()

const navigation = [
  { to: '/', label: 'Dashboard', code: 'DB' },
  { to: '/map', label: 'Traffic map', code: 'MP' },
  { to: '/cctv', label: 'CCTV management', code: 'CC' },
  { to: '/analysis', label: 'Traffic analysis', code: 'TA' },
  { to: '/settings', label: 'Settings', code: 'ST' },
] as const
</script>

<template>
  <button
    v-if="open"
    class="navigation-backdrop"
    type="button"
    aria-label="Close navigation"
    @click="$emit('close')"
  />

  <aside
    id="primary-navigation"
    class="sidebar"
    :class="{ 'sidebar--open': open }"
    aria-label="Primary navigation"
  >
    <div class="brand">
      <span class="brand__mark" aria-hidden="true">
        <span></span>
      </span>
      <span>
        <strong>{{ appConfig.name }}</strong>
        <small>{{ appConfig.versionLabel }}</small>
      </span>
    </div>

    <nav class="sidebar__nav">
      <p class="sidebar__label">Workspace</p>
      <RouterLink
        v-for="item in navigation"
        :key="item.to"
        :to="item.to"
        class="sidebar__link"
        @click="$emit('close')"
      >
        <span class="sidebar__icon" aria-hidden="true">{{ item.code }}</span>
        <span>{{ item.label }}</span>
      </RouterLink>
    </nav>

    <div class="sidebar__footer">
      <span class="status-dot" aria-hidden="true"></span>
      <span>
        <strong>Foundation mode</strong>
        <small>No backend connected</small>
      </span>
    </div>
  </aside>
</template>
