<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    message: string
    tone?: 'info' | 'warning'
  }>(),
  { tone: 'info' },
)
</script>

<template>
  <section class="phase-notice" :class="`phase-notice--${tone}`" role="status">
    <span class="phase-notice__icon" aria-hidden="true">i</span>
    <div>
      <h3>{{ title }}</h3>
      <p>{{ message }}</p>
    </div>
  </section>
</template>
