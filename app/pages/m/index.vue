<template></template>

<script setup lang="ts">
definePageMeta({
  middleware: ["auth"],
});

onMounted(() => {
  navigateTo("/m/calendar", { replace: true });
});
</script>
