<template>
  <div>
    <el-container>
      <el-header class="topFix haha" height="5px"> </el-header>
    </el-container>
    <el-container>
      <sidebar></sidebar>
      <el-container>
        <el-header>
          <headerCost propsTitle="Table | Edit"></headerCost>
        </el-header>
        <el-main>
          <cEdit :cctv="cctv" :csrf="csrf"></cEdit>
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>
<script>
export default {
  props: {
    cctv: { type: Object },
    csrf: { type: String },
  },
};
</script>

<style >
.topFix {
  background-color: var(--green-theme);
  height: 10px;
}
</style>