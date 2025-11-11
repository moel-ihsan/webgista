<template>
  <div>
    <el-container>
      <el-header class="topFix haha" height="5px"> </el-header>
    </el-container>
    <el-container>
      <sidebar></sidebar>
      <el-container>
        <el-header>
          <headerCost propsTitle="Settings"></headerCost>
        </el-header>
        <el-main>
          <cSettings :setti="setti" :csrf="csrf"></cSettings>
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script>
export default {
  props: {
    cctv: { type: Object },
    setti: { type: Object },
    csrf: { type: String },
  },
};
</script>

<style >
</style>