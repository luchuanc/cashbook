<script setup lang="ts">
import { FunnelIcon, PlusIcon, TrashIcon } from "@heroicons/vue/24/outline";
import type { Page } from "~/utils/model";

definePageMeta({
  layout: "mobile-v2",
  middleware: ["auth"],
});

const loading = ref(false);
const quickSheet = ref(false);
const flows = ref<any[]>([]);
const total = ref(0);
const { switchUiMode } = useUiMode();
const query = ref({
  pageNum: 1,
  pageSize: 30,
  flowType: "",
  name: "",
  startDay: "",
  endDay: "",
});

const groupedFlows = computed(() => {
  return flows.value.reduce<Record<string, any[]>>((groups, item) => {
    const day = item.day || "未知日期";
    groups[day] ||= [];
    groups[day].push(item);
    return groups;
  }, {});
});

const summary = computed(() => {
  return flows.value.reduce(
    (sum, item) => {
      if (item.flowType === "收入") sum.in += Number(item.money || 0);
      if (item.flowType === "支出") sum.out += Number(item.money || 0);
      if (item.flowType === "不计收支") sum.zero += Number(item.money || 0);
      return sum;
    },
    { in: 0, out: 0, zero: 0 }
  );
});

const formatCurrency = (value: number) => `¥${Number(value || 0).toFixed(2)}`;

const loadData = async () => {
  const bookId = localStorage.getItem("bookId");
  if (!bookId) {
    flows.value = [];
    total.value = 0;
    return;
  }

  loading.value = true;
  try {
    const res = await doApi.post<Page<any>>("api/entry/flow/page", {
      ...query.value,
      bookId,
    });
    flows.value = res?.data || [];
    total.value = res?.total || 0;
  } finally {
    loading.value = false;
  }
};

const setFlowType = (flowType: string) => {
  query.value.flowType = flowType;
  query.value.pageNum = 1;
  loadData();
};

const deleteFlow = (item: any) => {
  Confirm.open({
    title: "删除确认",
    content: `确定删除【${item.name || item.industryType || "这条流水"}】吗？`,
    confirm: async () => {
      const bookId = localStorage.getItem("bookId");
      if (!bookId) return;
      await doApi.post("api/entry/flow/del", {
        id: item.id,
        bookId,
      });
      Alert.success("删除成功");
      loadData();
    },
  });
};

onMounted(loadData);
</script>

<template>
  <div>
    <MobileV2PageHeader title="流水" subtitle="按日期查看和筛选账本流水" />

    <section class="space-y-4 px-4">
      <div class="rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
        <div class="flex gap-2">
          <input
            v-model="query.name"
            class="h-11 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-950"
            placeholder="搜索名称/备注"
            @keyup.enter="loadData"
          />
          <button class="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-900 text-white" @click="loadData">
            <FunnelIcon class="h-5 w-5" />
          </button>
        </div>
        <div class="mt-3 flex gap-2 overflow-x-auto pb-1">
          <button
            v-for="item in ['', '支出', '收入', '不计收支']"
            :key="item || '全部'"
            type="button"
            :class="[
              'h-9 shrink-0 rounded-lg px-3 text-sm font-semibold',
              query.flowType === item ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
            ]"
            @click="setFlowType(item)"
          >
            {{ item || "全部" }}
          </button>
          <button class="h-9 shrink-0 rounded-lg bg-slate-100 px-3 text-sm font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300" @click="switchUiMode('legacy', '/m/flows')">
            导入/导出
          </button>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-2">
        <MobileV2StatCard label="收入" :value="formatCurrency(summary.in)" tone="income" />
        <MobileV2StatCard label="支出" :value="formatCurrency(summary.out)" tone="expense" />
        <MobileV2StatCard label="不计收支" :value="formatCurrency(summary.zero)" tone="neutral" />
      </div>

      <button class="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 text-sm font-bold text-white" @click="quickSheet = true">
        <PlusIcon class="h-5 w-5" />
        新增流水
      </button>

      <div v-if="loading" class="py-10 text-center text-sm text-slate-500">加载中...</div>
      <section v-for="(items, day) in groupedFlows" v-else :key="day" class="space-y-2">
        <div class="sticky top-[72px] z-20 bg-[#FAFAF7]/95 py-1 text-sm font-bold text-slate-500 backdrop-blur dark:bg-slate-950/95">
          {{ day }}
        </div>
        <div v-for="item in items" :key="item.id" class="relative">
          <MobileV2FlowListItem :item="item" />
          <button class="absolute right-2 top-2 rounded-lg p-2 text-rose-500" @click="deleteFlow(item)">
            <TrashIcon class="h-4 w-4" />
          </button>
        </div>
      </section>

      <MobileV2EmptyState v-if="!loading && flows.length === 0" title="暂无流水" description="可以新增一笔，或调整筛选条件。" />
      <div v-if="total > flows.length" class="pb-4 text-center text-xs text-slate-400">
        当前显示 {{ flows.length }} / {{ total }} 条，可到旧版使用完整分页和批量操作。
      </div>
    </section>

    <MobileV2QuickFlowSheet :show="quickSheet" @close="quickSheet = false" @success="loadData" />
  </div>
</template>
