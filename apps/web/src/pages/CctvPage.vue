<script setup lang="ts">
import PageHeader from '../components/ui/PageHeader.vue'
import PhaseNotice from '../components/ui/PhaseNotice.vue'
</script>

<template>
  <div class="page-stack">
    <PageHeader
      eyebrow="CCTV registry"
      title="Camera locations and source capability"
      description="This module will manage normalized agencies, coordinates, snapshots, public stream capability, and calibration metadata."
    />

    <PhaseNotice
      title="Management is intentionally unavailable"
      message="Authentication, authorization, database validation, and safe object storage belong to Phase 2. No v1 mutation endpoint is reused here."
      tone="warning"
    />

    <section class="content-card empty-workspace">
      <span class="empty-workspace__mark" aria-hidden="true">CC</span>
      <h3>No CCTV data source connected</h3>
      <p>The interface will remain empty until a secured, typed data source is available.</p>
    </section>
  </div>
</template>
