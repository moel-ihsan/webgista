<template>
  <el-col :span="24" :xs="24">
    <div class="veh-info-card motor">
      <div class="veh-content">
        <div class="veh">Light Vehicle (LV)</div>
        <div id="result-car" class="total">{{ lvCount }}</div>
      </div>
    </div>
    <div class="veh-info-card motor">
      <div class="veh-content">
        <div class="veh">Heavy Vehicle (HV)</div>
        <div id="result-truck" class="total">{{ hvCount }}</div>
      </div>
    </div>
    <div class="veh-info-card motor" style="margin-top: 20px">
      <div class="veh-content">
        <div class="veh">Motorcycle (MC)</div>
        <div id="result-motor" class="total">{{ mcCount }}</div>
      </div>
    </div>
    <div class="veh-info-card motor" style="margin-top: 20px">
      <div class="veh-content">
        <div class="veh">Traffic Condition</div>
        <div id="result-kendaraan" class="veh">{{ conditionLabel }}</div>
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
.veh-info-card {
  position: relative;
  cursor: default;
  background-color: var(--color-secondary);
  color: var(--text-color);
  height: 100px;
  border-radius: 10px;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  margin-bottom: 20px;
  box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
  -webkit-box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
  -moz-box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
}

.veh-info-card:before {
  content: "";
  position: absolute;
  left: 50%;
  transform: translate(-50%);
  bottom: -0.3em;
  height: 20px;
  width: 80%;
  border-radius: 0px 0px 20px 20px;
  z-index: -2;
  background: var(--green-theme);
  box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
  -webkit-box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
  -moz-box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
  transition: 0.5s;
}

.veh-info-card:hover:before {
  width: 95%;
}

.veh-content {
  position: relative;
  left: 0;
  padding: 40px;
}

.veh {
  font-size: var(--size-lg);
}

.veh-info-card:hover .total {
  color: var(--green-theme);
}

.total {
  font-size: var(--size-xl);
  font-weight: 500;
  color: var(--text-color);
  transition: 0.5s;
}

@media screen and (max-width: 992px) {
  .veh-content {
    position: relative;
    left: 0;
    padding: 20px;
  }
}

@media screen and (max-width: 600px) {
  .veh-info-card.motor {
    margin-top: 30px;
  }
}
</style>
