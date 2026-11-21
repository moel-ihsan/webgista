<template>
  <AppLayout title="Table View">
    <CctvTable />
  </AppLayout>
</template>

<script>
import AppLayout from "../components/layout/AppLayout.vue";
import CctvTable from "../components/table/CctvTable.vue";

export default {
  name: "TableViewPage",
  components: {
    AppLayout,
    CctvTable
  }
};
</script>
