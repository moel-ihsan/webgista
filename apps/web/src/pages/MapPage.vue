<script setup lang="ts">
import TrafficMap from '../components/map/TrafficMap.vue'
import PageHeader from '../components/ui/PageHeader.vue'
</script>

<template>
  <div class="page-stack page-stack--map">
    <PageHeader
      eyebrow="Interactive map"
      title="Geographic context before traffic data"
      description="Explore the validated Banda Aceh administrative boundary. CCTV markers and traffic conditions will be added only after the Phase 2 data boundary is secured."
    />

    <TrafficMap />
  </div>
</template>
