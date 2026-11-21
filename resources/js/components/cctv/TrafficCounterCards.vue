<template>
  <el-col :span="24" :xs="24" class="counter-cards-stack">
    <div class="veh-info-card">
      <div class="veh-content">
        <div class="veh">Light Vehicle (LV)</div>
        <div id="result-car" class="total">{{ lvCount }}</div>
      </div>
    </div>
    <div class="veh-info-card">
      <div class="veh-content">
        <div class="veh">Heavy Vehicle (HV)</div>
        <div id="result-truck" class="total">{{ hvCount }}</div>
      </div>
    </div>
    <div class="veh-info-card">
      <div class="veh-content">
        <div class="veh">Motorcycle (MC)</div>
        <div id="result-motor" class="total">{{ mcCount }}</div>
      </div>
    </div>
    <div class="veh-info-card veh-info-card--condition">
      <div class="veh-content veh-content--row">
        <div>
          <div class="veh">Traffic Condition</div>
          <div id="result-kendaraan" class="total total--condition">{{ conditionLabel }}</div>
        </div>
        <TrafficGradeBadge :status="conditionLabel" />
      </div>
    </div>
  </el-col>
</template>

<script>
export default {
  name: "TrafficCounterCards",
  props: {
    lvCount: {
      type: Number,
      default: 0
    },
    hvCount: {
      type: Number,
      default: 0
    },
    mcCount: {
      type: Number,
      default: 0
    },
    conditionLabel: {
      type: String,
      default: "No Data"
    }
  }
};
</script>

<style>
.counter-cards-stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.veh-info-card {
  position: relative;
  cursor: default;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-bottom: 4px solid var(--accent-primary);
  color: var(--text-primary);
  min-height: 88px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  box-shadow: var(--shadow-card);
  transition: transform 0.15s ease, border-color 0.15s ease;
}

.veh-info-card:hover {
  transform: translateY(-1px);
}

.veh-content {
  width: 100%;
  padding: 16px 20px;
}

.veh-content--row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.veh {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-secondary);
}

.total {
  margin-top: 4px;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

.total--condition {
  font-size: var(--text-lg);
  color: var(--accent-primary);
}
</style>
