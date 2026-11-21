<template>
  <AppLayout title="CCTV Detail" main-class="mainmain" main-style="overflow: hidden">
    <CctvDetailView :cctv="cctv" />
  </AppLayout>
</template>

<script>
import CctvDetailView from "../components/cctv/CctvDetailView.vue";
import AppLayout from "../components/layout/AppLayout.vue";

export default {
  name: "CctvDetailPage",
  components: {
    AppLayout,
    CctvDetailView
  },
  props: {
    cctv: {
      type: Object,
      default: () => ({})
    }
  }
};
</script>
