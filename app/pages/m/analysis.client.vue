<script setup lang="ts">
import { SparklesIcon } from "@heroicons/vue/24/outline";
import type { CommonChartData } from "~/utils/model";

definePageMeta({
  layout: "mobile-v2",
  middleware: ["auth"],
});

const currentMonth = ref(new Date().toISOString().slice(0, 7));
const loading = ref(false);
const aiLoading = ref(false);
const aiAnalysis = ref("");
const monthData = ref<any>({});
const expenseTop = ref<CommonChartData[]>([]);
const payTop = ref<CommonChartData[]>([]);

const maxExpense = computed(() => {
  return Math.max(...expenseTop.value.map((item: any) => Number(item.outSum || 0)), 1);
});

const balance = computed(() => {
  return Number(monthData.value?.inSum || 0) - Number(monthData.value?.outSum || 0);
});

const formatCurrency = (value: number | string) => `¥${Number(value || 0).toFixed(2)}`;

const sortByExpenseAmount = (rows: CommonChartData[], limit?: number) => {
  const sorted = [...(rows || [])].sort(
    (a: any, b: any) => Number(b.outSum || 0) - Number(a.outSum || 0)
  );
  return limit ? sorted.slice(0, limit) : sorted;
};

const loadData = async () => {
  const bookId = localStorage.getItem("bookId");
  if (!bookId) {
    monthData.value = {};
    expenseTop.value = [];
    payTop.value = [];
    return;
  }

  loading.value = true;
  try {
    const startDay = `${currentMonth.value}-01`;
    const endDay = `${currentMonth.value}-31`;
    const [month, expense, pay] = await Promise.all([
      doApi.post<any>("api/entry/analytics/monthAnalysis", {
        bookId,
        month: currentMonth.value,
      }),
      doApi.post<CommonChartData[]>("api/entry/analytics/common", {
        bookId,
        startDay,
        endDay,
        groupBy: "industryType",
        flowType: "支出",
        queryField: "industryType",
        topN: 10,
      }),
      doApi.post<CommonChartData[]>("api/entry/analytics/common", {
        bookId,
        startDay,
        endDay,
        groupBy: "payType",
        flowType: "支出",
        queryField: "payType",
        topN: 6,
      }),
    ]);
    monthData.value = month || {};
    expenseTop.value = sortByExpenseAmount(expense || [], 10);
    payTop.value = sortByExpenseAmount(pay || [], 6);
  } finally {
    loading.value = false;
  }
};

const fetchAIAnalysis = async () => {
  const bookId = localStorage.getItem("bookId");
  if (!bookId) {
    aiAnalysis.value = "请先选择账本后再进行 AI 分析。";
    return;
  }

  aiLoading.value = true;
  aiAnalysis.value = "";
  try {
    const res = await doApi.post<{ analysis: string }>("api/entry/analytics/ai-analysis", {
      bookId,
      month: currentMonth.value,
    });
    aiAnalysis.value = res?.analysis || "暂无分析结果";
  } finally {
    aiLoading.value = false;
  }
};

watch(currentMonth, () => {
  aiAnalysis.value = "";
  loadData();
});

onMounted(loadData);
</script>

<template>
  <div>
    <MobileV2PageHeader title="分析" subtitle="月度收支、分类排行和 AI 建议" />

    <section class="space-y-4 px-4">
      <div class="rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
        <label class="text-xs font-semibold text-slate-500">月份</label>
        <input v-model="currentMonth" type="month" class="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-800 dark:bg-slate-950" />
      </div>

      <div class="grid grid-cols-2 gap-2">
        <MobileV2StatCard label="总收入" :value="formatCurrency(monthData?.inSum)" tone="income" />
        <MobileV2StatCard label="总支出" :value="formatCurrency(monthData?.outSum)" tone="expense" />
        <MobileV2StatCard label="全月结余" :value="formatCurrency(balance)" :tone="balance >= 0 ? 'income' : 'warning'" />
        <MobileV2StatCard label="不计收支" :value="formatCurrency(monthData?.zeroSum)" tone="neutral" />
      </div>

      <div class="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-base font-bold">消费类型前十</h2>
          <span class="text-xs text-slate-400">支出</span>
        </div>
        <div v-if="loading" class="py-8 text-center text-sm text-slate-500">加载中...</div>
        <div v-else class="space-y-3">
          <div v-for="item in expenseTop" :key="item.type">
            <div class="mb-1 flex justify-between text-sm">
              <span class="font-medium text-slate-700 dark:text-slate-200">{{ item.type || "未分类" }}</span>
              <span class="font-bold text-rose-600">{{ formatCurrency(item.outSum) }}</span>
            </div>
            <div class="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div class="h-full rounded-full bg-rose-500" :style="{ width: `${(Number(item.outSum || 0) / maxExpense) * 100}%` }" />
            </div>
          </div>
          <MobileV2EmptyState v-if="expenseTop.length === 0" title="暂无支出分析" />
        </div>
      </div>

      <div class="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
        <h2 class="mb-4 text-base font-bold">支付方式</h2>
        <div class="grid grid-cols-2 gap-2">
          <div v-for="item in payTop" :key="item.type" class="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
            <div class="truncate text-xs text-slate-500">{{ item.type || "未分类" }}</div>
            <div class="mt-1 text-base font-bold text-slate-900 dark:text-white">{{ formatCurrency(item.outSum) }}</div>
          </div>
        </div>
      </div>

      <div class="rounded-lg bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm ring-1 ring-emerald-100 dark:from-emerald-950/40 dark:to-slate-900 dark:ring-emerald-900">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="flex items-center gap-2 text-base font-bold">
            <SparklesIcon class="h-5 w-5 text-emerald-600" />
            AI 流水分析
          </h2>
          <button class="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60" :disabled="aiLoading" @click="fetchAIAnalysis">
            {{ aiLoading ? "分析中" : "重新分析" }}
          </button>
        </div>
        <p class="text-sm leading-6 text-slate-700 dark:text-slate-200">
          {{ aiAnalysis || "点击重新分析，查看本月消费结构、异常支出和节省建议。" }}
        </p>
      </div>
    </section>
  </div>
</template>
