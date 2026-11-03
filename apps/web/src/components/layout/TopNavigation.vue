<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

defineEmits<{ openNavigation: [] }>()
defineProps<{ navigationOpen: boolean }>()

const route = useRoute()
const title = computed(() => String(route.meta.title ?? 'WebGISTA'))
const eyebrow = computed(() => String(route.meta.eyebrow ?? 'Geographic information system'))
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
        <span></span><span></span><span></span>
      </button>
      <div>
        <p>{{ eyebrow }}</p>
        <h1>{{ title }}</h1>
      </div>
    </div>

    <span class="phase-badge">Phase 1</span>
  </header>
</template>
