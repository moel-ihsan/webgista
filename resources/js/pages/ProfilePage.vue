<template>
  <AppLayout title="CCTV | Profile">
    <ProfileForm :users="users" :csrf="csrf" />
  </AppLayout>
</template>

<script>
import ProfileForm from "../components/auth/ProfileForm.vue";
import AppLayout from "../components/layout/AppLayout.vue";

export default {
  name: "ProfilePage",
  components: {
    AppLayout,
    ProfileForm
  },
  props: {
    users: {
      type: Object,
      default: () => ({})
    },
    csrf: {
      type: String,
      default: ""
    }
  }
};
</script>
