require("./bootstrap");

import Vue from "vue";
import ElementUI from "element-ui";
import locale from "element-ui/lib/locale/lang/en";
import "element-ui/lib/theme-chalk/index.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "./styles/theme-overrides.css";
import "babel-polyfill";
import "whatwg-fetch";

import AppIcon from "./components/common/AppIcon.vue";
import TrafficGradeBadge from "./components/common/TrafficGradeBadge.vue";

Vue.config.ignoredElements = [/^ion-/];
Vue.use(ElementUI, { locale });

Vue.component("AppIcon", AppIcon);
Vue.component("TrafficGradeBadge", TrafficGradeBadge);

/* eslint-disable vue/component-definition-name-casing */
Vue.component("login", () => import(/* webpackChunkName: "page-login" */ "./pages/LoginPage.vue"));
Vue.component(
  "dashboard",
  () => import(/* webpackChunkName: "page-dashboard" */ "./pages/DashboardPage.vue")
);
Vue.component(
  "mapview",
  () => import(/* webpackChunkName: "page-map" */ "./pages/MapViewPage.vue")
);
Vue.component(
  "tableview",
  () => import(/* webpackChunkName: "page-table" */ "./pages/TableViewPage.vue")
);
Vue.component(
  "add",
  () => import(/* webpackChunkName: "page-cctv-add" */ "./pages/CctvAddPage.vue")
);
Vue.component(
  "edit",
  () => import(/* webpackChunkName: "page-cctv-edit" */ "./pages/CctvEditPage.vue")
);
Vue.component(
  "detail",
  () => import(/* webpackChunkName: "page-cctv-detail" */ "./pages/CctvDetailPage.vue")
);
Vue.component(
  "videodetail",
  () => import(/* webpackChunkName: "page-video-detail" */ "./pages/VideoDetailPage.vue")
);
Vue.component(
  "settings",
  () => import(/* webpackChunkName: "page-settings" */ "./pages/SettingsPage.vue")
);
Vue.component(
  "profile",
  () => import(/* webpackChunkName: "page-profile" */ "./pages/ProfilePage.vue")
);
Vue.component(
  "password",
  () => import(/* webpackChunkName: "page-password" */ "./pages/PasswordPage.vue")
);
/* eslint-enable vue/component-definition-name-casing */

new Vue({
  el: "#app"
});
