<template>
  <AppLayout title="Table | Edit">
    <CctvForm v-if="ready" :cctv="resolvedCctv" :csrf="csrf" />
  </AppLayout>
</template>

<script>
import AppLayout from "../components/layout/AppLayout.vue";
import CctvForm from "../components/table/CctvForm.vue";
import { ensureStaticAdmin, resolveStaticCctv } from "../services/api/staticPageHelper";
import { isStaticDemoMode } from "../services/api/staticStore";

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
  },
  data() {
    const hasProp = Boolean(this.cctv && this.cctv.id);
    return {
      resolvedCctv: this.cctv || {},
      ready: hasProp || !isStaticDemoMode()
    };
  },
  created() {
    if (isStaticDemoMode()) {
      ensureStaticAdmin().then(({ allowed }) => {
        if (!allowed) {
          return;
        }
        if (this.ready) {
          return;
        }
        resolveStaticCctv().then((record) => {
          this.resolvedCctv = record;
          this.ready = true;
        });
      });
    }
  }
};
</script>
