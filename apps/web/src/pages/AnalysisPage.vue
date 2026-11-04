<template>
  <div class="legacy-analysis">
    <section class="legacy-video-column" aria-label="CCTV video workspace">
      <div class="legacy-video-stage" role="img" aria-label="No CCTV video connected">
        <div class="legacy-video-stage__message">
          <span class="legacy-video-stage__icon" aria-hidden="true">▶</span>
          <strong>No CCTV video selected</strong>
          <span>Live streams and stored clips are not connected.</span>
        </div>
      </div>
      <div class="legacy-video-actions">
        <button class="legacy-button legacy-button--primary" type="button" disabled title="Video processing is not implemented">
          Manage Video
        </button>
        <button class="legacy-button legacy-button--outline" type="button" disabled title="No video source is connected">
          Show Video
        </button>
      </div>
      <div class="legacy-observation-note">
        Counts will appear only for persisted observations with a documented counting method.
      </div>
    </section>

    <aside class="legacy-analysis-summary" aria-label="Traffic observation summary">
      <div class="legacy-analysis-summary__heading">
        <h2>Camera not selected</h2>
        <span class="legacy-state-tag">No Data</span>
      </div>

      <article class="legacy-vehicle-card">
        <div><h3>Light Vehicle (LV)</h3><strong>—</strong><p>No persisted observations</p></div>
        <img src="/assets/Car.png" alt="" />
      </article>
      <article class="legacy-vehicle-card">
        <div><h3>Heavy Vehicle (HV)</h3><strong>—</strong><p>No persisted observations</p></div>
        <span class="legacy-vehicle-card__mark" aria-hidden="true">HV</span>
      </article>
      <article class="legacy-vehicle-card">
        <div><h3>Motorcycle (MC)</h3><strong>—</strong><p>No persisted observations</p></div>
        <img src="/assets/Motor.png" alt="" />
      </article>
      <article class="legacy-vehicle-card legacy-vehicle-card--condition">
        <div><h3>Traffic Condition</h3><strong>No Data</strong><p>No validated traffic result is available.</p></div>
      </article>
    </aside>
  </div>
</template>
