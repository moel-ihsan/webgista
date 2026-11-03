<script setup lang="ts">
import PageHeader from '../components/ui/PageHeader.vue'
import PhaseNotice from '../components/ui/PhaseNotice.vue'
import { appConfig } from '../config/app'
</script>

<template>
  <div class="page-stack">
    <PageHeader
      eyebrow="Runtime configuration"
      title="Explicit public settings"
      description="Only non-secret frontend configuration is visible in this phase. Persistent settings and administration require Phase 2 authorization."
    />

    <PhaseNotice
      title="Settings are read-only"
      message="There is no database connection, authentication, or mutation API in this foundation."
    />

    <section class="content-card settings-list">
      <div>
        <span>Basemap provider</span>
        <strong>OpenFreeMap / OpenStreetMap data</strong>
      </div>
      <div>
        <span>Map style source</span>
        <strong>{{ appConfig.map.usesDefaultStyle ? 'Documented default' : 'Environment override' }}</strong>
      </div>
      <div>
        <span>Boundary data</span>
        <strong>Local validated v1 GeoJSON copy</strong>
      </div>
      <div>
        <span>Backend</span>
        <strong>Not connected</strong>
      </div>
    </section>
  </div>
</template>
