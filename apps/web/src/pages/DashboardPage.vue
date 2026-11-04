<script setup lang="ts">
import TrafficMap from '../components/map/TrafficMap.vue'
</script>

<template>
  <div class="legacy-dashboard">
    <section class="legacy-dashboard__map" aria-labelledby="dashboard-map-title">
      <header class="legacy-section-heading">
        <h2 id="dashboard-map-title">CCTV Locations</h2>
        <span class="legacy-section-heading__note">Banda Aceh</span>
      </header>
      <div class="legacy-map-card">
        <TrafficMap compact />
        <div class="legacy-legend" aria-label="CCTV category legend">
          <h3>CCTV Category</h3>
          <div><span class="legend-dot legend-dot--analytic"></span>Analytic</div>
          <div><span class="legend-dot legend-dot--regular"></span>Regular</div>
          <p>Traffic observations are not loaded.</p>
        </div>
      </div>
    </section>

    <aside class="legacy-office-card" aria-labelledby="office-profile-title">
      <div class="legacy-office-card__photo" aria-hidden="true">
        <span>WebGIS</span>
      </div>
      <div class="legacy-office-card__content">
        <h2 id="office-profile-title">Office Profile</h2>
        <p class="legacy-unavailable">Agency profile is not connected.</p>
        <dl class="legacy-profile-fields">
          <div><dt>Address</dt><dd>Not available</dd></div>
          <div><dt>Coordinates</dt><dd>Not available</dd></div>
          <div><dt>Description</dt><dd>Not available</dd></div>
        </dl>
        <section class="legacy-recent" aria-labelledby="recent-cctv-title">
          <h3 id="recent-cctv-title">Recently Updated</h3>
          <div class="legacy-recent__empty">CCTV update history is not connected.</div>
        </section>
      </div>
    </aside>
  </div>
</template>
