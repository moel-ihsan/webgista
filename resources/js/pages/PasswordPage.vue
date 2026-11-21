<template>
  <AppLayout title="CCTV | Password">
    <PasswordForm v-if="ready" :users="resolvedUser" :csrf="csrf" />
  </AppLayout>
</template>

<script>
import PasswordForm from "../components/auth/PasswordForm.vue";
import AppLayout from "../components/layout/AppLayout.vue";
import { ensureStaticAdmin } from "../services/api/staticPageHelper";
import { isStaticDemoMode } from "../services/api/staticStore";

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
  },
  data() {
    return {
      resolvedUser: this.users || {},
      ready: !isStaticDemoMode()
    };
  },
  created() {
    if (!this.ready && isStaticDemoMode()) {
      ensureStaticAdmin().then(({ allowed, user }) => {
        if (!allowed) {
          return;
        }
        if (user) {
          this.resolvedUser = user;
        }
        this.ready = true;
      });
    }
  }
};
</script>
