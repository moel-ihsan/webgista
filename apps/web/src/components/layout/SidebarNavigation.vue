<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { authSession } from '../../auth/session'
import { navigationForRole } from '../../navigation'
import AppIcon from '../ui/AppIcon.vue'

defineProps<{ collapsed: boolean; open: boolean }>()
const emit = defineEmits<{ close: []; toggle: []; logout: [] }>()

const navigation = computed(() => navigationForRole(authSession.state.role))
</script>

<template>
  <button
    v-if="open"
    class="navigation-backdrop"
    type="button"
    aria-label="Close navigation"
    @click="emit('close')"
  />

  <aside
    id="primary-navigation"
    class="sidebar"
    :class="{ 'sidebar--collapsed': collapsed, 'sidebar--mobile-open': open }"
    aria-label="Primary navigation"
  >
    <button
      class="sidebar__toggle"
      type="button"
      :aria-expanded="!collapsed"
      :aria-label="collapsed ? 'Expand navigation' : 'Collapse navigation'"
      @click="emit('toggle')"
    >
      <AppIcon :name="collapsed ? 'menu' : 'close'" :size="23" />
    </button>

    <nav class="sidebar__nav">
      <RouterLink
        v-for="item in navigation"
        :key="item.to"
        :to="item.to"
        class="sidebar__link"
        :title="collapsed ? item.label : undefined"
        @click="emit('close')"
      >
        <AppIcon class="sidebar__icon" :name="item.icon" :size="21" />
        <span>{{ item.label }}</span>
      </RouterLink>

      <button
        v-if="authSession.state.status === 'authenticated'"
        class="sidebar__link sidebar__logout"
        type="button"
        :title="collapsed ? 'Log Out' : undefined"
        @click="emit('logout')"
      >
        <AppIcon class="sidebar__icon" name="logout" :size="21" />
        <span>Log Out</span>
      </button>
    </nav>
  </aside>
</template>
