<template>
  <div>
    <el-aside
      :style="{ width: isCollapse ? '84px' : '220px' }"
      style="transition: all 0.35s; overflow: hidden"
    >
      <div class="hihi">
        <div class="toggle-sidebar-custom">
          <ion-icon v-if="isCollapse" name="menu" @click="handleCollapse(false)" />
          <ion-icon v-else name="filter" @click="handleCollapse(true)" />
        </div>

        <el-menu
          :default-active="active"
          class="el-menu-vertical-demo is-hover hihi"
          :collapse="isCollapse"
        >
          <a href="/">
            <el-menu-item index="1" disabled>
              <ion-icon name="home" />
              <span slot="title">Dashboard</span>
            </el-menu-item>
          </a>
          <a href="/map">
            <el-menu-item index="2" disabled>
              <ion-icon name="map" />
              <span slot="title">View Map</span>
            </el-menu-item>
          </a>
          <a href="/table">
            <el-menu-item index="3" disabled>
              <ion-icon name="list" />
              <span slot="title">Data Table</span>
            </el-menu-item>
          </a>
          <a v-if="role === 'admin'" href="/setting/1">
            <el-menu-item index="4" disabled>
              <ion-icon name="settings" />
              <span slot="title">Settings</span>
            </el-menu-item>
          </a>
          <a v-if="role === 'admin'" href="/logout">
            <el-menu-item index="5" disabled>
              <ion-icon name="log-out" />
              <span slot="title">Log Out</span>
            </el-menu-item>
          </a>
        </el-menu>
      </div>
    </el-aside>
  </div>
</template>

<script>
import { fetchAuthUser } from "../../services/api/authApi";

export default {
  name: "AppSidebar",
  data() {
    return {
      isCollapse: true,
      currentUrl: "",
      active: "1",
      role: ""
    };
  },
  created() {
    this.loadAuthUser();
  },
  mounted() {
    this.currentUrl = window.location.pathname;
    if (this.currentUrl === "/map") {
      this.active = "2";
    } else if (this.currentUrl.startsWith("/table")) {
      this.active = "3";
    } else if (this.currentUrl.startsWith("/setting")) {
      this.active = "4";
    }
  },
  methods: {
    loadAuthUser() {
      fetchAuthUser()
        .then((data) => {
          if (data && data.user) {
            this.role = data.user.role || "";
          }
        })
        .catch(() => {});
    },
    handleCollapse(newCollapse) {
      this.isCollapse = newCollapse;
    }
  }
};
</script>

<style>
.toggle-sidebar-custom {
  margin: 10px;
  width: 64px;
  height: 64px;
  display: flex;
  justify-content: center;
  align-items: center;
  transition: 0.5s;
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

.is-hover .el-menu-item.is-active:hover {
  background: #333;
}

.el-tooltip {
  color: whitesmoke;
  padding: 0px 13px !important;
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
  border-radius: 10px;
  margin-left: 10px;
  background: linear-gradient(90deg, rgba(66, 183, 130, 1) 0%, rgba(58, 155, 108, 1) 100%);
}

.el-menu-vertical-demo:not(.el-menu--collapse) {
  width: 200px;
  border: none;
  border-radius: 10px;
  margin-left: 10px;
}

.toggle-sidebar-custom ion-icon {
  color: var(--text-color);
  transition: 0.5s;
}

.is-hover .el-menu-item.is-disabled {
  color: whitesmoke !important;
}

.toggle-sidebar-custom ion-icon:hover {
  color: #32e18c;
  transition: 0.5s;
  cursor: pointer;
}

.el-menu-item {
  color: white;
}

.el-menu-item span {
  font-size: var(--size-sm);
}

.is-hover .el-menu-item.is-disabled:hover span {
  cursor: pointer;
  transition: 0.5s;
  color: #32e18c;
}

.el-menu-vertical-demo ion-icon {
  transition: 0.5s;
  font-size: var(--size-lg);
}

.is-hover .el-menu-item.is-disabled ion-icon {
  margin-right: 10px;
}

.is-hover .el-menu-item.is-disabled:hover ion-icon {
  cursor: pointer;
  color: #32e18c;
  transition: 0.5s;
}

.is-hover .el-menu-item {
  line-height: 45px;
  height: 45px;
  margin: 10px !important;
}

.is-hover .el-menu-item.is-active.is-disabled {
  background-color: white !important;
  border-radius: 10px !important;
}

.is-hover .el-menu-item.is-disabled {
  padding: 0 13px !important;
}

.is-hover .el-menu-item.is-active.is-disabled ion-icon,
.is-hover .el-menu-item.is-active.is-disabled span {
  color: #32e18c;
}

a:hover {
  color: var(--text-color);
  text-decoration: none;
}
</style>
