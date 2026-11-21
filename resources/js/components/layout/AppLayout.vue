<template>
  <div>
    <el-container>
      <el-header class="topFix haha" height="5px" />
    </el-container>
    <el-container>
      <AppSidebar />
      <el-container>
        <el-header>
          <AppHeader :props-title="title" />
        </el-header>
        <el-main :class="mainClass" :style="mainStyle">
          <SimulationBanner />
          <slot />
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script>
import AppSidebar from "./AppSidebar.vue";
import AppHeader from "./AppHeader.vue";
import SimulationBanner from "./SimulationBanner.vue";

export default {
  name: "AppLayout",
  components: {
    AppSidebar,
    AppHeader,
    SimulationBanner
  },
  props: {
    title: {
      type: String,
      required: true
    },
    mainClass: {
      type: String,
      default: ""
    },
    mainStyle: {
      type: [String, Object],
      default: ""
    }
  }
};
</script>
