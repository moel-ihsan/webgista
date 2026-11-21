<template>
  <AppLayout title="Video Detail" main-class="mainmain">
    <VideoDetectorPlayer :cctv="cctv" />
  </AppLayout>
</template>

<script>
import VideoDetectorPlayer from "../components/cctv/VideoDetectorPlayer.vue";
import AppLayout from "../components/layout/AppLayout.vue";

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
  }
};
</script>
