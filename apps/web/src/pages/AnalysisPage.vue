<script setup lang="ts">
import PageHeader from '../components/ui/PageHeader.vue'
import PhaseNotice from '../components/ui/PhaseNotice.vue'
</script>

<template>
  <div class="page-stack">
    <PageHeader
      eyebrow="Traffic observations"
      title="Analysis begins with reproducible measurements"
      description="Future views will separate per-frame detections, tracked line crossings, and manually verified ground truth."
    />

    <PhaseNotice
      title="No charts or vehicle totals are shown"
      message="The v1 dashboard values were not connected to a reliable observation history. Phase 1 does not replace them with fabricated demonstration statistics."
    />

    <section class="content-card analysis-principles">
      <h3>Required provenance for every result</h3>
      <dl>
        <div><dt>Time window</dt><dd>Start, end, and timezone</dd></div>
        <div><dt>Counting method</dt><dd>Frame, tracked crossing, or manual</dd></div>
        <div><dt>Model context</dt><dd>Model, threshold, class map, and quality flags</dd></div>
        <div><dt>Formula context</dt><dd>Named version with documented units</dd></div>
      </dl>
    </section>
  </div>
</template>
