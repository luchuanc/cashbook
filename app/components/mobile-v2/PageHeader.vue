<script setup lang="ts">
import { ArrowPathIcon } from "@heroicons/vue/24/outline";

defineProps<{
  title: string;
  subtitle?: string;
}>();

const { switchUiMode } = useUiMode();
</script>

<template>
  <header class="sticky top-0 z-30 bg-[#FAFAF7]/95 px-4 pb-3 pt-[max(env(safe-area-inset-top),12px)] backdrop-blur dark:bg-slate-950/95">
    <div class="flex items-center justify-between gap-3">
      <div class="min-w-0">
        <h1 class="truncate text-xl font-bold tracking-normal text-slate-950 dark:text-white">{{ title }}</h1>
        <p v-if="subtitle" class="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{{ subtitle }}</p>
      </div>
      <button
        type="button"
        class="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
        @click="switchUiMode('legacy')"
      >
        <ArrowPathIcon class="h-4 w-4" />
        旧版UI
      </button>
    </div>
  </header>
</template>
