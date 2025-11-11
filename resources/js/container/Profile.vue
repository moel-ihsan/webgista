<template>
  <div>
    <el-container>
      <el-header class="topFix haha" height="5px"> </el-header>
    </el-container>
    <el-container>
      <sidebar></sidebar>
      <el-container>
        <el-header>
          <headerCost propsTitle="CCTV | Profile"></headerCost>
        </el-header>
        <el-main>
          <cProfile :users="users" :csrf="csrf"></cProfile>
        </el-main>        
      </el-container>
    </el-container>
  </div>
</template>

<script>
export default {
  props: {
    users: { type: Object },
    csrf: { type: String },
  },
};
</script>

<style >
</style>