<template>
  <AppLayout title="Settings">
    <MapSettingsPanel :setti="setti" :csrf="csrf" />
  </AppLayout>
</template>

<script>
import AppLayout from "../components/layout/AppLayout.vue";
import MapSettingsPanel from "../components/settings/MapSettingsPanel.vue";

export default {
  name: "SettingsPage",
  components: {
    AppLayout,
    MapSettingsPanel
  },
  props: {
    cctv: {
      type: Object,
      default: () => ({})
    },
    setti: {
      type: Object,
      default: () => ({})
    },
    csrf: {
      type: String,
      default: ""
    }
  }
};
</script>
