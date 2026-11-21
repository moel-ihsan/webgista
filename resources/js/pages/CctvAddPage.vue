<template>
  <AppLayout title="Table | Add">
    <CctvForm v-if="ready" />
  </AppLayout>
</template>

<script>
import AppLayout from "../components/layout/AppLayout.vue";
import CctvForm from "../components/table/CctvForm.vue";
import { ensureStaticAdmin } from "../services/api/staticPageHelper";
import { isStaticDemoMode } from "../services/api/staticStore";

export default {
  name: "CctvAddPage",
  components: {
    AppLayout,
    CctvForm
  },
  data() {
    return {
      ready: !isStaticDemoMode()
    };
  },
  created() {
    if (!this.ready && isStaticDemoMode()) {
      ensureStaticAdmin().then(({ allowed }) => {
        if (allowed) {
          this.ready = true;
        }
      });
    }
  }
};
</script>
