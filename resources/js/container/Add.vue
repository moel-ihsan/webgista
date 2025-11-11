<template>
  <div>
    <el-container>
      <el-header class="topFix haha" height="5px"> </el-header>
    </el-container>
    <el-container>
      <sidebar></sidebar>
      <el-container>
        <el-header>
          <headerCost propsTitle="Table | Add"></headerCost>
        </el-header>
        <el-main>
          <cAdd></cAdd>
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<style >
.topFix {
  background-color: var(--green-theme);
  height: 10px;
}
</style>