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
          <slot />
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script>
import AppHeader from "./AppHeader.vue";
import AppSidebar from "./AppSidebar.vue";

export default {
  name: "AppLayout",
  components: {
    AppHeader,
    AppSidebar
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
