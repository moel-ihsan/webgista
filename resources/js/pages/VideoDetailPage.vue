<template>
  <div>
    <el-container>
      <el-header class="topFix haha" height="5px" />
    </el-container>
    <el-container>
      <el-container>
        <el-main style="">
          <SimulationBanner />
          <VideoDetectorPlayer :cctv="cctv" />
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script>
import SimulationBanner from "../components/layout/SimulationBanner.vue";
import VideoDetectorPlayer from "../components/cctv/VideoDetectorPlayer.vue";

export default {
  name: "VideoDetailPage",
  components: {
    SimulationBanner,
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

<style>
.topFix {
  background-color: var(--green-theme);
  height: 10px;
}
</style>
