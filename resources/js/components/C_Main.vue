<template>
  <div style="overflow: hidden">
    <el-row :gutter="30">
      <el-col :span="15" :xs="24" :md="24" :lg="15">
        <cardInfoCCTV></cardInfoCCTV>
      </el-col>
      <el-col :span="9" :xs="24" :md="24" :lg="9">
        <cardProfilOffice :users="users"></cardProfilOffice>
      </el-col>
    </el-row>
  </div>
</template>

<script>
export default {
  data() {
    return {
      users: {},
    };
  },
  created() {
    this.fetchUser();
  },
  methods: {
    fetchUser() {
      console.log("tes");
      axios
        .get("/profileUser")
        .then((res) => {
          this.users = res.data.user;
        })
        .catch((err) => console.log(err));
    },
  },
};
</script>

<style>
.el-carousel__item.is-active.is-animating {
  z-index: 0;
}
</style>

