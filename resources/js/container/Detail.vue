<template>
  <div>
    <el-container>
      <el-header class="topFix haha" height="5px"> </el-header>
    </el-container>
    <el-container>
      <sidebar></sidebar>
      <el-container>
        <el-header>
          <headerCost propsTitle="CCTV Detail"></headerCost>
        </el-header>
        <el-main style="overflow: hidden" class="mainmain">
          <cDetail :cctv="cctv"></cDetail>
        </el-main>        
      </el-container>
    </el-container>
  </div>
</template>

<script>
export default {
  props: {
    cctv: { type: Object },
  },
};
</script>

<style >
.topFix {
  background-color: var(--green-theme);
  height: 10px;
}
</style>