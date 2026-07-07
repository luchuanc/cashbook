<script setup lang="ts">
defineProps<{
  label: string;
  value: string | number;
  tone?: "income" | "expense" | "neutral" | "warning";
}>();
</script>

<template>
  <div
    :class="[
      'rounded-lg border p-3 shadow-sm',
      tone === 'income'
        ? 'border-emerald-100 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200'
        : tone === 'expense'
          ? 'border-rose-100 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200'
          : tone === 'warning'
            ? 'border-amber-100 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200'
            : 'border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100',
    ]"
  >
    <div class="text-xs opacity-75">{{ label }}</div>
    <div class="mt-1 truncate text-lg font-bold">{{ value }}</div>
  </div>
</template>
