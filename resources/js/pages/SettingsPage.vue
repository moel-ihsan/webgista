<template>
  <AppLayout title="Settings">
    <MapSettingsPanel v-if="ready" :setti="resolvedSettings" :csrf="csrf" />
  </AppLayout>
</template>

<script>
import AppLayout from "../components/layout/AppLayout.vue";
import MapSettingsPanel from "../components/settings/MapSettingsPanel.vue";
import { ensureStaticAdmin, resolveStaticMapSetting } from "../services/api/staticPageHelper";
import { isStaticDemoMode } from "../services/api/staticStore";

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
  },
  data() {
    const hasProp = Boolean(this.setti && this.setti.id);
    return {
      resolvedSettings: this.setti || {},
      ready: hasProp || !isStaticDemoMode()
    };
  },
  created() {
    if (isStaticDemoMode()) {
      ensureStaticAdmin().then(({ allowed }) => {
        if (!allowed || this.ready) {
          return;
        }
        resolveStaticMapSetting().then((setting) => {
          this.resolvedSettings = setting;
          this.ready = true;
        });
      });
    }
  }
};
</script>
