<template>
  <div>
    <el-container>
      <el-header class="topFix haha" height="5px" />
    </el-container>
    <el-container>
      <el-header>
        <el-menu
          :default-active="activeIndex2"
          class="el-menu-demo"
          mode="horizontal"
          background-color="transparent"
        >
          <div class="nav-right">
            <el-menu-item index="2" disabled>
              <el-switch v-model="themeSetting" active-color="white" inactive-color="#27293d" />
            </el-menu-item>
          </div>
        </el-menu>
      </el-header>
      <el-main>
        <LoginForm :csrf="csrf" />
      </el-main>
      <el-footer />
    </el-container>
  </div>
</template>

<script>
import LoginForm from "../components/auth/LoginForm.vue";

export default {
  name: "LoginPage",
  components: {
    LoginForm
  },
  props: {
    csrf: {
      type: String,
      default: ""
    }
  },
  data() {
    return {
      activeIndex2: "1",
      themeSetting: true
    };
  }
};
</script>
