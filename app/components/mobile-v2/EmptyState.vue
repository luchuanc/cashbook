<script setup lang="ts">
defineProps<{
  title: string;
  description?: string;
}>();
</script>

<template>
  <div class="rounded-lg border border-dashed border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
    <div class="text-base font-semibold text-slate-800 dark:text-slate-100">{{ title }}</div>
    <div v-if="description" class="mt-2 text-sm text-slate-500 dark:text-slate-400">{{ description }}</div>
  </div>
</template>
