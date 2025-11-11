<template>
  <div>
    <el-container>
      <el-header class="topFix haha" height="5px"> </el-header>
    </el-container>
    <el-container>
      <el-container>
        <el-main style="">
          <cVideodetail :cctv="cctv" :csrf="csrf"></cVideodetail>
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