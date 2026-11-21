<template>
  <AppLayout title="Dashboard" main-class="mainmain">
    <div style="overflow: hidden">
      <el-row :gutter="30">
        <el-col :span="15" :xs="24" :md="24" :lg="15">
          <DashboardCctvMap />
        </el-col>
        <el-col :span="9" :xs="24" :md="24" :lg="9">
          <OfficeProfileCard :users="users" />
        </el-col>
      </el-row>
    </div>
  </AppLayout>
</template>

<script>
import OfficeProfileCard from "../components/dashboard/OfficeProfileCard.vue";
import AppLayout from "../components/layout/AppLayout.vue";
import DashboardCctvMap from "../components/map/DashboardCctvMap.vue";
import { fetchOfficeProfile } from "../services/api/authApi";

export default {
  name: "DashboardPage",
  components: {
    AppLayout,
    DashboardCctvMap,
    OfficeProfileCard
  },
  data() {
    return {
      users: {}
    };
  },
  created() {
    this.loadOfficeProfile();
  },
  methods: {
    loadOfficeProfile() {
      fetchOfficeProfile()
        .then((res) => {
          this.users = (res && res.user) || {};
        })
        .catch(() => {});
    }
  }
};
</script>

<style>
.el-carousel__item.is-active.is-animating {
  z-index: 0;
}
</style>
