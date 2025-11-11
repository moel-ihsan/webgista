<template>
  <div>
    <el-container class="container-aside">
      <el-aside
        :style="{ width: isCollapse ? '84px' : '220px' }"
        style="transition: all 0.35s; overflow: hidden"
      >
        <div class="toggle-sidebar-custom">
          <el-button
            v-if="isCollapse"
            @click="isCollapse = false"
            icon="el-icon-search"
            type="success"
            circle
          >
          </el-button>
          <el-button
            v-else
            @click="isCollapse = true"
            icon="el-icon-check"
            type="warning"
            circle
          ></el-button>
        </div>

        <el-menu
          default-active="1"
          class="el-menu-vertical-demo"
          :collapse="isCollapse"
        >
          <el-menu-item index="1">
            <i class="el-icon-location"></i>
            <span slot="title">Navigator One</span>
          </el-menu-item>
          <el-menu-item index="2">
            <i class="el-icon-menu"></i>
            <span slot="title">Navigator Two</span>
          </el-menu-item>
          <el-menu-item index="3">
            <i class="el-icon-document"></i>
            <span slot="title">Navigator Three</span>
          </el-menu-item>
          <el-menu-item index="4">
            <i class="el-icon-setting"></i>
            <span slot="title">Navigator Four</span>
          </el-menu-item>
        </el-menu>
      </el-aside>
      <el-container style="background: black" height="100vh">
        <el-header>Headernya</el-header>
        <el-main>Mainnya</el-main>
      </el-container>
    </el-container>
  </div>
</template>

<style>
.toggle-sidebar-custom {
  margin: 10px;
  width: 64px;
  height: 64px;
  display: flex;
  justify-content: center;
  align-items: center;
}

ul {
  padding: 50px 0 50px 0;
}

.el-menu-item {
  background: transparent;
  color: whitesmoke;
}

ul .el-menu-item:hover {
  background: #222;
  color: whitesmoke;
}

.el-menu-item.is-active {
  color: whitesmoke;
  background: #333;
}

.el-menu-item.is-active i {
  color: whitesmoke;
}

.el-menu-item.is-active:hover {
  background: #333;
}

.el-tooltip {
  color: whitesmoke;
}

.el-tooltip:hover {
  color: whitesmoke;
}

.el-menu-item i::before {
  color: whitesmoke;
}

.el-menu-item i:hover,
.el-menu-item span:hover,
.el-menu-item i::before:hover {
  color: whitesmoke;
}

.el-menu-vertical-demo {
  border: none;
  border-radius: 20px;
  margin-left: 10px;
  background: #111;
}

.el-menu-vertical-demo:not(.el-menu--collapse) {
  width: 200px;
  border: none;
  border-radius: 20px;
  margin-left: 10px;
}

.container-aside {
  background: whitesmoke;
}
</style>

<script>
export default {
  data() {
    return {
      isCollapse: true,
    };
  },
};
</script>