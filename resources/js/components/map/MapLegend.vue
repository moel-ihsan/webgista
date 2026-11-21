<template>
  <div id="state-legend" class="legend">
    <h4>{{ title }}</h4>
    <div v-for="item in items" :key="item.label">
      <span :style="{ backgroundColor: item.color }" />{{ item.label }}
    </div>
  </div>
</template>

<script>
export default {
  name: "MapLegend",
  props: {
    title: {
      type: String,
      required: true
    },
    items: {
      type: Array,
      required: true
    }
  }
};
</script>

<style>
.legend {
  background-color: var(--color-secondary);
  border-radius: 10px;
  bottom: 10px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  font-size: var(--size-sm);
  padding: 10px;
  position: absolute;
  right: 10px;
  z-index: 1;
  color: var(--text-color);
}

.legend h4 {
  margin: 0 0 10px;
  font-size: var(--size-md);
}

.legend div span {
  border-radius: 10px;
  display: inline-block;
  height: 10px;
  margin-right: 5px;
  width: 10px;
}
</style>
