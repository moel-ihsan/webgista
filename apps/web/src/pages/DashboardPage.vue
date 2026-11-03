<script setup lang="ts">
import { RouterLink } from 'vue-router'

import PageHeader from '../components/ui/PageHeader.vue'
import PhaseNotice from '../components/ui/PhaseNotice.vue'

const foundationItems = [
  { label: 'Frontend', value: 'Vue 3 + TypeScript', state: 'Ready' },
  { label: 'Web GIS', value: 'MapLibre + Banda Aceh boundary', state: 'Ready' },
  { label: 'Data services', value: 'Supabase / PostgreSQL', state: 'Phase 2' },
  { label: 'Traffic observations', value: 'No persisted data', state: 'Not connected' },
] as const
</script>

<template>
  <div class="page-stack">
    <PageHeader
      eyebrow="WebGISTA v2"
      title="Traffic research, with traceable data"
      description="A clean Web GIS foundation for CCTV locations, reproducible observations, and honest traffic analysis."
    >
      <RouterLink class="button button--primary" to="/map">Open traffic map</RouterLink>
    </PageHeader>

    <PhaseNotice
      title="No traffic statistics are available yet"
      message="Phase 1 does not connect to a database or generate demonstration counts. Metrics will appear only after persisted observations are implemented and validated."
    />

    <section class="dashboard-grid" aria-label="Foundation status">
      <article v-for="item in foundationItems" :key="item.label" class="status-card">
        <p>{{ item.label }}</p>
        <strong>{{ item.value }}</strong>
        <span>{{ item.state }}</span>
      </article>
    </section>

    <section class="content-card research-card">
      <div>
        <p class="eyebrow">Research guardrails</p>
        <h3>Measurements will keep their context</h3>
        <p>
          Future traffic results will identify the counting method, observation window, model and
          formula version. Frame detections will never be presented as unique vehicle counts.
        </p>
      </div>
      <ol class="research-steps">
        <li><span>01</span> Register and validate CCTV locations</li>
        <li><span>02</span> Record bounded observation windows</li>
        <li><span>03</span> Visualize only persisted results</li>
      </ol>
    </section>
  </div>
</template>
