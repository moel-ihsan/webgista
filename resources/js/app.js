require("./bootstrap");

import Vue from "vue";
import ElementUI from "element-ui";
import "element-ui/lib/theme-chalk/index.css";
import "./styles/theme-overrides.css";
import "babel-polyfill";
import "whatwg-fetch";

import LoginPage from "./pages/LoginPage.vue";
import DashboardPage from "./pages/DashboardPage.vue";
import MapViewPage from "./pages/MapViewPage.vue";
import TableViewPage from "./pages/TableViewPage.vue";
import CctvAddPage from "./pages/CctvAddPage.vue";
import CctvEditPage from "./pages/CctvEditPage.vue";
import CctvDetailPage from "./pages/CctvDetailPage.vue";
import VideoDetailPage from "./pages/VideoDetailPage.vue";
import SettingsPage from "./pages/SettingsPage.vue";
import ProfilePage from "./pages/ProfilePage.vue";
import PasswordPage from "./pages/PasswordPage.vue";

Vue.config.ignoredElements = [/^ion-/];
Vue.use(ElementUI);

/* eslint-disable vue/component-definition-name-casing */
Vue.component("login", LoginPage);
Vue.component("dashboard", DashboardPage);
Vue.component("mapview", MapViewPage);
Vue.component("tableview", TableViewPage);
Vue.component("add", CctvAddPage);
Vue.component("edit", CctvEditPage);
Vue.component("detail", CctvDetailPage);
Vue.component("videodetail", VideoDetailPage);
Vue.component("settings", SettingsPage);
Vue.component("profile", ProfilePage);
Vue.component("password", PasswordPage);
/* eslint-enable vue/component-definition-name-casing */

new Vue({
  el: "#app"
});
