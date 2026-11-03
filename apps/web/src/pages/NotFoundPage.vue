<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <section class="not-found">
    <p class="eyebrow">404</p>
    <h2>This map does not cover that route.</h2>
    <p>The requested page is not part of the WebGISTA v2 foundation.</p>
    <RouterLink class="button button--primary" to="/">Return to dashboard</RouterLink>
  </section>
</template>
