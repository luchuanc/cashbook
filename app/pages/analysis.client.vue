<template>
  <div class="w-full">
    <!-- Content Area -->
    <div class="xl:max-w-[80vw] mx-auto w-full mt-2">
      <!-- Desktop & Tablet: Chart Carousel -->
      <div class="w-full" v-if="!loading">
        <!-- 按月流水分析 -->
        <div class="w-full bg-surface dark:bg-surface-dark rounded-lg shadow border border-frame dark:border-frame-dark p-2 md:p-4 mb-4">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-base md:text-lg font-semibold text-ink-primary dark:text-ink-onDark flex items-center gap-2">
              按月流水分析 
              <button @click="prevMonth" class="px-2 py-0.5 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded">
                &lt;
              </button>
              <span class="text-sm font-medium">{{ currentMonth }}</span>
              <button @click="nextMonth" class="px-2 py-0.5 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded">
                &gt;
              </button>
            </h3>
            <div class="flex items-center gap-4">
              <!-- PC端图表类型切换 -->
              <div class="hidden md:flex bg-surface-muted dark:bg-surface-darkMuted rounded-lg p-1">
                <button
                  @click="monthChartType = 'pie'"
                  :class="[
                    'px-3 py-1 text-sm font-medium rounded-md transition-colors',
                    monthChartType === 'pie'
                      ? 'bg-brand-600 text-white'
                      : 'text-ink-muted hover:text-ink-primary dark:hover:text-ink-onDark',
                  ]"
                >
                  饼图
                </button>
                <button
                  @click="monthChartType = 'bar'"
                  :class="[
                    'px-3 py-1 text-sm font-medium rounded-md transition-colors',
                    monthChartType === 'bar'
                      ? 'bg-brand-600 text-white'
                      : 'text-ink-muted hover:text-ink-primary dark:hover:text-ink-onDark',
                  ]"
                >
                  柱图
                </button>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-sm text-ink-muted hidden md:inline">流水归属:</span>
                <select v-model="selectedAttribution" class="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500">
                  <option value="">全部</option>
                  <option v-for="item in attributionList" :key="item" :value="item">{{ item }}</option>
                </select>
              </div>
            </div>
          </div>
          <!-- 移动端图表类型切换 - 独立行居中 -->
          <div class="flex md:hidden justify-center mb-4">
            <div class="flex bg-surface-muted dark:bg-surface-darkMuted rounded-lg p-1">
              <button
                @click="monthChartType = 'pie'"
                :class="[
                  'px-3 py-1 text-sm font-medium rounded-md transition-colors',
                  monthChartType === 'pie'
                    ? 'bg-brand-600 text-white'
                    : 'text-ink-muted hover:text-ink-primary dark:hover:text-ink-onDark',
                ]"
              >
                饼图
              </button>
              <button
                @click="monthChartType = 'bar'"
                :class="[
                  'px-3 py-1 text-sm font-medium rounded-md transition-colors',
                  monthChartType === 'bar'
                    ? 'bg-brand-600 text-white'
                    : 'text-ink-muted hover:text-ink-primary dark:hover:text-ink-onDark',
                ]"
              >
                柱图
              </button>
            </div>
          </div>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
            <div class="bg-green-50 dark:bg-green-900/20 p-3 md:p-4 rounded-lg">
              <div class="text-xs md:text-sm text-green-600 dark:text-green-400 mb-1">总收入</div>
              <div class="text-lg md:text-xl font-bold text-green-700 dark:text-green-300">¥ {{ monthData?.inSum || '0.00' }}</div>
            </div>
            <div class="bg-red-50 dark:bg-red-900/20 p-3 md:p-4 rounded-lg">
              <div class="text-xs md:text-sm text-red-600 dark:text-red-400 mb-1">总支出</div>
              <div class="text-lg md:text-xl font-bold text-red-700 dark:text-red-300">¥ {{ monthData?.outSum || '0.00' }}</div>
            </div>
            <div class="bg-blue-50 dark:bg-blue-900/20 p-3 md:p-4 rounded-lg">
              <div class="text-xs md:text-sm text-blue-600 dark:text-blue-400 mb-1">全月结余</div>
              <div class="text-lg md:text-xl font-bold text-blue-700 dark:text-blue-300">¥ {{ ((Number(monthData?.inSum || 0) - Number(monthData?.outSum || 0))).toFixed(2) }}</div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-800/50 p-3 md:p-4 rounded-lg">
              <div class="text-xs md:text-sm text-gray-600 dark:text-gray-400 mb-1">不计收支</div>
              <div class="text-lg md:text-xl font-bold text-gray-700 dark:text-gray-300">¥ {{ monthData?.zeroSum || '0.00' }}</div>
            </div>
          </div>
          <!-- 月度消费前十饼图 -->
          <div class="mt-4 border-t border-frame dark:border-frame-dark pt-4 w-full">
            <ChartsCommonPie
              v-if="monthChartType === 'pie'"
              :title="currentMonth + ' 消费类型前十'"
              width="100%"
              height="300px"
              groupBy="industryType"
              flowType="支出"
              seriesName="消费类型"
              :showLegend="true"
              queryField="industryType"
              :startDay="currentMonth + '-01'"
              :endDay="currentMonth + '-31'"
              :attribution="selectedAttribution || undefined"
              :topN="10"
            />
            <ChartsCommonBar
              v-if="monthChartType === 'bar'"
              :title="currentMonth + ' 消费类型前十'"
              width="100%"
              height="300px"
              groupBy="industryType"
              flowType="支出"
              seriesName="消费类型"
              :showLegend="true"
              queryField="industryType"
              :startDay="currentMonth + '-01'"
              :endDay="currentMonth + '-31'"
              :attribution="selectedAttribution || undefined"
              :topN="10"
            />
          </div>
        </div>

        <div
          class="w-full bg-surface dark:bg-surface-dark rounded-lg shadow border border-frame dark:border-frame-dark p-2 md:p-4 mb-4"
        >
          <!-- Chart Container -->
          <div
            class="w-full flex flex-col md:flex-row justify-between md:space-x-4 space-y-4 md:space-y-0 rounded-md p-2"
          >
            <div class="w-full border-b md:border-b-0 md:border-r">
              <DailyLineChart
                title="每日流水曲线"
                width="100%"
                height="300px"
              />
            </div>
            <div class="w-full">
              <MonthBar title="每月流水统计" width="100%" height="320px" />
            </div>
          </div>
        </div>
        <div
          class="w-full bg-surface dark:bg-surface-dark rounded-lg shadow border border-frame dark:border-frame-dark p-2 md:p-4 mb-4"
        >
          <!-- Chart Container -->
          <div
            class="flex justify-between items-center flex-col md:flex-row gap-2 md:gap-4 md:items-center w-full md:w-auto mb-4"
          >
            <h3 class="min-w-20 text-base md:text-lg font-semibold text-ink-primary dark:text-ink-onDark">
              支出分析
            </h3>
            <!-- 时间筛选和图表类型切换 -->
            <!-- 时间筛选 -->
            <div class="flex gap-2 items-center flex-wrap">
              <UiDatePicker
                v-model="expenseStartDay"
                placeholder="开始日期"
                class="text-sm md:text-base w-36 md:w-48"
                clearable
              />
              <span class="text-ink-muted">至</span>
              <UiDatePicker
                v-model="expenseEndDay"
                placeholder="结束日期"
                class="text-sm md:text-base w-36 md:w-48"
                clearable
                position="right"
              />
            </div>
            <!-- 图表类型切换 -->
            <div class="flex bg-surface-muted dark:bg-surface-darkMuted rounded-lg p-1">
              <button
                @click="expenseChartType = 'pie'"
                :class="[
                  'px-3 py-1 text-sm font-medium rounded-md transition-colors',
                  expenseChartType === 'pie'
                    ? 'bg-brand-600 text-white'
                    : 'text-ink-muted hover:text-ink-primary dark:hover:text-ink-onDark',
                ]"
              >
                饼图
              </button>
              <button
                @click="expenseChartType = 'bar'"
                :class="[
                  'px-3 py-1 text-sm font-medium rounded-md transition-colors',
                  expenseChartType === 'bar'
                    ? 'bg-brand-600 text-white'
                    : 'text-ink-muted hover:text-ink-primary dark:hover:text-ink-onDark',
                ]"
              >
                柱图
              </button>
            </div>
          </div>

          <!-- 饼图展示 -->
          <div
            v-if="expenseChartType === 'pie'"
            class="w-full flex flex-col md:flex-row justify-between md:space-x-4 space-y-4 md:space-y-0 rounded-md p-2"
          >
            <div class="w-full border-b md:border-b-0 md:border-r">
              <ChartsCommonPie
                title="支付方式分析"
                width="100%"
                height="300px"
                groupBy="payType"
                flowType="支出"
                seriesName="支付方式"
                :showLegend="true"
                queryField="payType"
                :startDay="expenseStartDay || undefined"
                :endDay="expenseEndDay || undefined"
              />
            </div>
            <div class="w-full border-b md:border-b-0 md:border-r">
              <ChartsCommonPie
                title="消费类型分析"
                width="100%"
                height="300px"
                groupBy="industryType"
                flowType="支出"
                seriesName="消费类型"
                :showLegend="true"
                queryField="industryType"
                :startDay="expenseStartDay || undefined"
                :endDay="expenseEndDay || undefined"
              />
            </div>
            <div class="w-full">
              <ChartsCommonPie
                title="消费归属分析"
                width="100%"
                height="300px"
                groupBy="attribution"
                flowType="支出"
                seriesName="消费归属"
                :showLegend="true"
                queryField="attribution"
                :startDay="expenseStartDay || undefined"
                :endDay="expenseEndDay || undefined"
              />
            </div>
          </div>
        </div>

        <!-- 柱图展示 -->
        <div
          v-if="expenseChartType === 'bar'"
          class="w-full flex flex-col md:flex-row justify-between md:space-x-4 space-y-4 md:space-y-0 rounded-md p-2"
        >
          <div class="w-full border-b md:border-b-0 md:border-r">
            <ChartsCommonBar
              title="支付方式分析"
              width="100%"
              height="300px"
              groupBy="payType"
              flowType="支出"
              seriesName="支付方式"
              :showLegend="true"
              queryField="payType"
              :startDay="expenseStartDay || undefined"
              :endDay="expenseEndDay || undefined"
            />
          </div>
          <div class="w-full border-b md:border-b-0 md:border-r">
            <ChartsCommonBar
              title="消费类型分析"
              width="100%"
              height="300px"
              groupBy="industryType"
              flowType="支出"
              seriesName="消费类型"
              :showLegend="true"
              queryField="industryType"
              :startDay="expenseStartDay || undefined"
              :endDay="expenseEndDay || undefined"
            />
          </div>
          <div class="w-full">
            <ChartsCommonBar
              title="消费归属分析"
              width="100%"
              height="300px"
              groupBy="attribution"
              flowType="支出"
              seriesName="消费归属"
              :showLegend="true"
              queryField="attribution"
              :startDay="expenseStartDay || undefined"
              :endDay="expenseEndDay || undefined"
            />
          </div>
        </div>
      </div>
      <div
        class="w-full bg-surface dark:bg-surface-dark rounded-lg shadow border border-frame dark:border-frame-dark p-2 md:p-4 mb-4"
      >
        <!-- Chart Container -->
        <div
          class="flex flex-col md:flex-row justify-between items-center gap-2 md:gap-4 md:items-center w-full md:w-auto mb-4"
        >
          <h3
            class="min-w-20 text-base md:text-lg font-semibold text-ink-primary dark:text-ink-onDark"
          >
            收入分析
          </h3>
          <!-- 时间筛选和图表类型切换 -->
          <!-- 时间筛选 -->
          <div class="flex gap-2 items-center flex-wrap">
            <UiDatePicker
              v-model="incomeStartDay"
              placeholder="开始日期"
              class="text-sm md:text-base w-36 md:w-48"
              clearable
            />
            <span class="text-ink-muted">至</span>
            <UiDatePicker
              v-model="incomeEndDay"
              placeholder="结束日期"
              class="text-sm md:text-base w-36 md:w-48"
              clearable
              position="right"
            />
          </div>
          <!-- 图表类型切换 -->
          <div class="flex bg-surface-muted dark:bg-surface-darkMuted rounded-lg p-1">
            <button
              @click="incomeChartType = 'pie'"
              :class="[
                'px-3 py-1 text-sm font-medium rounded-md transition-colors',
                incomeChartType === 'pie'
                  ? 'bg-brand-600 text-white'
                  : 'text-ink-muted hover:text-ink-primary dark:hover:text-ink-onDark',
              ]"
            >
              饼图
            </button>
            <button
              @click="incomeChartType = 'bar'"
              :class="[
                'px-3 py-1 text-sm font-medium rounded-md transition-colors',
                incomeChartType === 'bar'
                  ? 'bg-brand-600 text-white'
                  : 'text-ink-muted hover:text-ink-primary dark:hover:text-ink-onDark',
              ]"
            >
              柱图
            </button>
          </div>
        </div>
        <!-- 饼图展示 -->
        <div
          v-if="incomeChartType === 'pie'"
          class="w-full flex flex-col md:flex-row justify-between md:space-x-4 space-y-4 md:space-y-0 rounded-md p-2"
        >
          <div class="w-full border-b md:border-b-0 md:border-r">
            <ChartsCommonPie
              title="收款方式分析"
              width="100%"
              height="300px"
              groupBy="payType"
              flowType="收入"
              seriesName="收款方式"
              :showLegend="true"
              queryField="payType"
              :startDay="incomeStartDay || undefined"
              :endDay="incomeEndDay || undefined"
            />
          </div>
          <div class="w-full border-b md:border-b-0 md:border-r">
            <ChartsCommonPie
              title="收入类型分析"
              width="100%"
              height="300px"
              groupBy="industryType"
              flowType="收入"
              seriesName="收入类型"
              :showLegend="true"
              queryField="industryType"
              :startDay="incomeStartDay || undefined"
              :endDay="incomeEndDay || undefined"
            />
          </div>
          <div class="w-full">
            <ChartsCommonPie
              title="收入归属分析"
              width="100%"
              height="300px"
              groupBy="attribution"
              flowType="收入"
              seriesName="收入归属"
              :showLegend="true"
              queryField="attribution"
              :startDay="incomeStartDay || undefined"
              :endDay="incomeEndDay || undefined"
            />
          </div>
        </div>

        <!-- 柱图展示 -->
        <div
          v-if="incomeChartType === 'bar'"
          class="w-full flex flex-col md:flex-row justify-between md:space-x-4 space-y-4 md:space-y-0 rounded-md p-2"
        >
          <div class="w-full border-b md:border-b-0 md:border-r">
            <ChartsCommonBar
              title="收款方式分析"
              width="100%"
              height="300px"
              groupBy="payType"
              flowType="收入"
              seriesName="收款方式"
              :showLegend="true"
              queryField="payType"
              :startDay="incomeStartDay || undefined"
              :endDay="incomeEndDay || undefined"
            />
          </div>
          <div class="w-full border-b md:border-b-0 md:border-r">
            <ChartsCommonBar
              title="收入类型分析"
              width="100%"
              height="300px"
              groupBy="industryType"
              flowType="收入"
              seriesName="收入类型"
              :showLegend="true"
              queryField="industryType"
              :startDay="incomeStartDay || undefined"
              :endDay="incomeEndDay || undefined"
            />
          </div>
          <div class="w-full">
            <ChartsCommonBar
              title="收入归属分析"
              width="100%"
              height="300px"
              groupBy="attribution"
              flowType="收入"
              seriesName="收入归属"
              :showLegend="true"
              queryField="attribution"
              :startDay="incomeStartDay || undefined"
              :endDay="incomeEndDay || undefined"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: "public",
  middleware: ["auth"],
});

import { ref, onMounted, onUnmounted, onBeforeUnmount, nextTick, watch } from "vue";
import { doApi } from "@/utils/api";
import DailyLineChart from "~/components/charts/DailyLineChart.vue";
import MonthBar from "~/components/charts/MonthBar.vue";

const windowWidth = ref(
  typeof window !== "undefined" ? window.innerWidth : 1200
);

// 当月流水分析相关逻辑
const currentMonth = ref(new Date().toISOString().slice(0, 7));
const attributionList = ref<string[]>([]);
const selectedAttribution = ref<string>("");
const monthData = ref<any>({});

const fetchAttributions = async () => {
  const res = await doApi.post<string[]>("api/entry/flow/getAttributions", {
    bookId: localStorage.getItem("bookId"),
  });
  attributionList.value = res || [];
};

const fetchMonthAnalysis = async () => {
  const res = await doApi.post<any>("api/entry/analytics/monthAnalysis", {
    bookId: localStorage.getItem("bookId"),
    month: currentMonth.value,
    attribution: selectedAttribution.value || undefined,
  });
  if (res) {
    monthData.value = res;
  } else {
    // 接口可能抛出空数据异常，给个兜底
    monthData.value = {};
  }
};

const prevMonth = () => {
  const [year, month] = currentMonth.value.split('-').map(Number);
  const date = new Date(year, month - 2, 1); // JS Date months are 0-indexed
  currentMonth.value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const nextMonth = () => {
  const [year, month] = currentMonth.value.split('-').map(Number);
  const date = new Date(year, month, 1);
  currentMonth.value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

watch([selectedAttribution, currentMonth], () => {
  fetchMonthAnalysis();
});

// 图表类型切换状态
const monthChartType = ref<"pie" | "bar">("pie");
const expenseChartType = ref<"pie" | "bar">("pie");
const incomeChartType = ref<"pie" | "bar">("pie");

// 时间筛选状态
const expenseStartDay = ref<string | null>(null);
const expenseEndDay = ref<string | null>(null);
const incomeStartDay = ref<string | null>(null);
const incomeEndDay = ref<string | null>(null);

// 窗口大小变化监听
const handleResize = () => {
  windowWidth.value = window.innerWidth;
};

const loading = ref(true);
onMounted(async () => {
  if (typeof window !== "undefined") {
    window.addEventListener("resize", handleResize);
  }
  
  fetchAttributions();
  fetchMonthAnalysis();
  
  // 等待DOM完全渲染
  await nextTick();
  loading.value = false;
});

onBeforeUnmount(() => {
  // 清理资源
  loading.value = true;
});

onUnmounted(() => {
  if (typeof window !== "undefined") {
    window.removeEventListener("resize", handleResize);
  }
});
</script>
