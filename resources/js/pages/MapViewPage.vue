<template>
  <AppLayout title="Map View">
    <TrafficMap />
  </AppLayout>
</template>

<script>
import AppLayout from "../components/layout/AppLayout.vue";
import TrafficMap from "../components/map/TrafficMap.vue";

export default {
  name: "MapViewPage",
  components: {
    AppLayout,
    TrafficMap
  }
};
</script>
