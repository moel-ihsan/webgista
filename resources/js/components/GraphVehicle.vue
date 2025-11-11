<template>
  <div class="small">
    <line-chart :height="250"></line-chart>
  </div>
</template>

<script>
import LineChart from "./LineChart.js";

export default {
  components: {
    LineChart,
  },
};
</script>

<style lang="css">
.small {
  position: relative;
  width: 100%;
  height: auto;
  padding: 20px;
  margin-top: 50px;
}
</style>