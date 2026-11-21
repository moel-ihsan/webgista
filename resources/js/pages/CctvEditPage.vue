<template>
  <AppLayout title="Table | Edit">
    <CctvForm :cctv="cctv" :csrf="csrf" />
  </AppLayout>
</template>

<script>
import AppLayout from "../components/layout/AppLayout.vue";
import CctvForm from "../components/table/CctvForm.vue";

export default {
  name: "CctvEditPage",
  components: {
    AppLayout,
    CctvForm
  },
  props: {
    cctv: {
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
