<template>
  <AppLayout title="CCTV Detail" main-class="mainmain" main-style="overflow: hidden">
    <CctvDetailView v-if="ready" :cctv="resolvedCctv" />
  </AppLayout>
</template>

<script>
import CctvDetailView from "../components/cctv/CctvDetailView.vue";
import AppLayout from "../components/layout/AppLayout.vue";
import { resolveStaticCctv } from "../services/api/staticPageHelper";
import { isStaticDemoMode } from "../services/api/staticStore";

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
  },
  data() {
    const hasProp = Boolean(this.cctv && this.cctv.id);
    return {
      resolvedCctv: this.cctv || {},
      ready: hasProp || !isStaticDemoMode()
    };
  },
  created() {
    if (!this.ready && isStaticDemoMode()) {
      resolveStaticCctv()
        .then((record) => {
          this.resolvedCctv = record;
          this.ready = true;
        })
        .catch(() => {
          this.ready = true;
        });
    }
  }
};
</script>
