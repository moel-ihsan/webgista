require('./bootstrap');

import Vue from "vue";

Vue.config.ignoredElements = [/^ion-/]

import ElementUI from 'element-ui';
// import Chart from 'chart.js';
import 'element-ui/lib/theme-chalk/index.css';
import "babel-polyfill";
import 'whatwg-fetch';


// Components import
import SideBar from "./components/SideBar.vue"
import Header from "./components/Header.vue"

import C_Login from "./components/C_Login.vue"
import C_Register from "./components/C_Register.vue"

import C_Main from "./components/C_Main.vue"
import CardInfoCCTV from "./components/CardInfoCCTV.vue"
import CardProfilOffice from "./components/CardProfilOffice.vue"
import CardRecent from "./components/CardRecent.vue"
import CardVehicle from "./components/CardVehicle.vue"
import GraphVehicle from "./components/GraphVehicle.vue"

import C_Map from "./components/C_Map.vue"
import SearchCard from "./components/SearchCard.vue"

import C_Table from "./components/C_Table.vue"
import C_Add from "./components/C_Add.vue"
import C_Edit from "./components/C_Edit.vue"
import C_Detail from "./components/C_Detail.vue"
import C_Videodetail from "./components/C_Videodetail.vue"

import C_Settings from "./components/C_Settings.vue"

import C_Profile from "./components/C_Profile.vue"
import C_Password from "./components/C_Password.vue"


// container import
import Login from "./container/Login.vue"
import Register from "./container/Register.vue"

import Dashboard from "./container/Dashboard.vue"
import MapView from "./container/Mapview.vue"

import TableView from "./container/Tableview.vue"
import Add from "./container/Add.vue"
import Edit from "./container/Edit.vue"
import Detail from "./container/Detail.vue"
import Videodetail from "./container/Videodetail.vue"

import Settings from "./container/Settings.vue"

import Profile from "./container/Profile.vue"
import Password from "./container/Password.vue"


Vue.use(ElementUI);
// Vue.use(Chart);

// Container use
Vue.component('login', Login);
Vue.component('register', Register);

Vue.component('dashboard', Dashboard);
Vue.component('mapview', MapView);

Vue.component('tableview', TableView);
Vue.component('add', Add);
Vue.component('edit', Edit);
Vue.component('detail', Detail);
Vue.component('videodetail', Videodetail);

Vue.component('settings', Settings);

Vue.component('profile', Profile);
Vue.component('password', Password);

// Components use
Vue.component('sidebar', SideBar);
Vue.component('headerCost', Header);

Vue.component('cLogin', C_Login);
Vue.component('cRegister', C_Register);

Vue.component('cMain', C_Main);
Vue.component('cardInfoCCTV', CardInfoCCTV);
Vue.component('cardProfilOffice', CardProfilOffice);
Vue.component('cardRecent', CardRecent);
Vue.component('cardVehicle', CardVehicle);
Vue.component('graphVehicle', GraphVehicle);

Vue.component('cMap', C_Map);
Vue.component('searchCard', SearchCard);

Vue.component('cTable', C_Table);
Vue.component('cAdd', C_Add);
Vue.component('cEdit', C_Edit);
Vue.component('cDetail', C_Detail);
Vue.component('cVideodetail', C_Videodetail);

Vue.component('cSettings', C_Settings);

Vue.component('cProfile', C_Profile);
Vue.component('cPassword', C_Password);


require("@tensorflow/tfjs");
require("@tensorflow/tfjs-backend-cpu");
require("@tensorflow/tfjs-backend-webgl");
const cocoSsd = require("@tensorflow-models/coco-ssd");

(async () => {
  window.onload = () => (window.modelPromise = cocoSsd.load());
})();


const app = new Vue({
  el: '#app',
});