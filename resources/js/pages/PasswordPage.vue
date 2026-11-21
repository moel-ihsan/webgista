<template>
  <AppLayout title="CCTV | Password">
    <PasswordForm :users="users" :csrf="csrf" />
  </AppLayout>
</template>

<script>
import PasswordForm from "../components/auth/PasswordForm.vue";
import AppLayout from "../components/layout/AppLayout.vue";

export default {
  name: "PasswordPage",
  components: {
    AppLayout,
    PasswordForm
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
