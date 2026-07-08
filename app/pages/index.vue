<template></template>

<script setup lang="ts">
definePageMeta({
  auth: ["auth"],
});
onMounted(() => {
  navigateTo(getUiMode() === "mobile-v2" ? "/m/calendar" : "/calendar", {
    replace: true,
  });
});
</script>

<style scoped></style>
