<script setup lang="ts">
const props = defineProps<{
  item: any;
}>();

const amountClass = computed(() => {
  if (props.item?.flowType === "收入") return "text-emerald-600 dark:text-emerald-300";
  if (props.item?.flowType === "支出") return "text-rose-600 dark:text-rose-300";
  return "text-slate-500 dark:text-slate-400";
});

const amountText = computed(() => {
  const money = Number(props.item?.money || 0).toFixed(2);
  if (props.item?.flowType === "收入") return `+¥${money}`;
  if (props.item?.flowType === "支出") return `-¥${money}`;
  return `¥${money}`;
});
</script>

<template>
  <div class="flex items-center gap-3 rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
    <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      {{ (item.industryType || item.flowType || "账").slice(0, 1) }}
    </div>
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2">
        <div class="truncate text-sm font-semibold text-slate-950 dark:text-white">
          {{ item.name || item.industryType || "未命名流水" }}
        </div>
        <span class="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          {{ item.flowType || "未知" }}
        </span>
      </div>
      <div class="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
        {{ item.industryType || "-" }} · {{ item.payType || "-" }} · {{ item.attribution || "未归属" }}
      </div>
    </div>
    <div :class="['shrink-0 text-right text-sm font-bold', amountClass]">{{ amountText }}</div>
  </div>
</template>
