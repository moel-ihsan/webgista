<template>
  <AppLayout title="Table | Add">
    <CctvForm />
  </AppLayout>
</template>

<script>
import AppLayout from "../components/layout/AppLayout.vue";
import CctvForm from "../components/table/CctvForm.vue";

export default {
  name: "CctvAddPage",
  components: {
    AppLayout,
    CctvForm
  }
};
</script>
