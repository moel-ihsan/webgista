<template>
  <AppLayout title="CCTV | Profile">
    <ProfileForm v-if="ready" :users="resolvedUser" :csrf="csrf" />
  </AppLayout>
</template>

<script>
import ProfileForm from "../components/auth/ProfileForm.vue";
import AppLayout from "../components/layout/AppLayout.vue";
import { ensureStaticAdmin } from "../services/api/staticPageHelper";
import { isStaticDemoMode } from "../services/api/staticStore";

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
  },
  data() {
    const hasProp = Boolean(this.users && this.users.id);
    return {
      resolvedUser: this.users || {},
      ready: hasProp || !isStaticDemoMode()
    };
  },
  created() {
    if (isStaticDemoMode()) {
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
