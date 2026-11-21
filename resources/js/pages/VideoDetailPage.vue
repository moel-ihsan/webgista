<template>
  <AppLayout title="Video Detail" main-class="mainmain">
    <VideoDetectorPlayer v-if="ready" :cctv="resolvedCctv" />
  </AppLayout>
</template>

<script>
import VideoDetectorPlayer from "../components/cctv/VideoDetectorPlayer.vue";
import AppLayout from "../components/layout/AppLayout.vue";
import { resolveStaticCctv } from "../services/api/staticPageHelper";
import { isStaticDemoMode } from "../services/api/staticStore";

export default {
  name: "VideoDetailPage",
  components: {
    AppLayout,
    VideoDetectorPlayer
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
