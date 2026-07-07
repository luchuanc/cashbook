<script setup lang="ts">
import { ArrowPathIcon, PlusIcon, TrashIcon } from "@heroicons/vue/24/outline";

definePageMeta({
  layout: "mobile-v2",
  middleware: ["auth"],
});

const selectedMonth = ref(new Date().toISOString().slice(0, 7));
const loading = ref(false);
const budget = ref<any>({});
const fixedFlows = ref<any[]>([]);
const budgetDialog = ref(false);
const fixedDialog = ref(false);
const editBudget = ref(0);
const editFixed = ref<any>({});

const fixedTotal = computed(() => fixedFlows.value.reduce((sum, item) => sum + Number(item.money || 0), 0));
const totalBudget = computed(() => Number(budget.value?.budget || 0));
const usedAmount = computed(() => Number(budget.value?.used || 0));
const availableAmount = computed(() => totalBudget.value - fixedTotal.value);
const remainingAmount = computed(() => availableAmount.value - usedAmount.value);
const usedPercent = computed(() => (totalBudget.value > 0 ? Math.min(Math.round((usedAmount.value / totalBudget.value) * 100), 999) : 0));
const formatCurrency = (value: number) => `¥${Number(value || 0).toFixed(2)}`;

const loadData = async () => {
  const bookId = localStorage.getItem("bookId");
  if (!bookId) {
    budget.value = { budget: 0, used: 0 };
    fixedFlows.value = [];
    return;
  }

  loading.value = true;
  try {
    const [budgetRows, fixedRows] = await Promise.all([
      doApi.post<any[]>("api/entry/budget/list", { bookId, month: selectedMonth.value }),
      doApi.post<any[]>("api/entry/fixedFlow/list", { bookId, month: selectedMonth.value }),
    ]);
    budget.value = budgetRows?.[0] || { budget: 0, used: 0 };
    fixedFlows.value = fixedRows || [];
  } finally {
    loading.value = false;
  }
};

const reloadUsedAmount = async () => {
  const bookId = localStorage.getItem("bookId");
  if (!bookId) return;
  await doApi.post("api/entry/budget/reloadUsedAmount", {
    bookId,
    month: selectedMonth.value,
  });
  Alert.success("已刷新额度");
  loadData();
};

const openBudgetDialog = () => {
  editBudget.value = Number(budget.value?.budget || 0);
  budgetDialog.value = true;
};

const saveBudget = async () => {
  const bookId = localStorage.getItem("bookId");
  if (!bookId) return;
  const data = {
    bookId,
    month: selectedMonth.value,
    budget: Number(editBudget.value || 0),
  };
  await doApi.post(budget.value?.id ? "api/entry/budget/update" : "api/entry/budget/add", {
    ...data,
    id: budget.value?.id,
  });
  Alert.success("预算已保存");
  budgetDialog.value = false;
  loadData();
};

const openFixedDialog = (item?: any) => {
  editFixed.value = item
    ? { ...item, startMonth: item.month || selectedMonth.value, endMonth: item.month || selectedMonth.value }
    : {
        month: selectedMonth.value,
        startMonth: selectedMonth.value,
        endMonth: selectedMonth.value,
        flowType: "支出",
      };
  fixedDialog.value = true;
};

const saveFixed = async () => {
  const bookId = localStorage.getItem("bookId");
  if (!bookId) return;
  const data = {
    ...editFixed.value,
    bookId,
    month: selectedMonth.value,
    startMonth: editFixed.value.startMonth || selectedMonth.value,
    endMonth: editFixed.value.endMonth || selectedMonth.value,
    money: Number(editFixed.value.money || 0),
  };
  await doApi.post(editFixed.value?.id ? "api/entry/fixedFlow/update" : "api/entry/fixedFlow/add", data);
  Alert.success("固定支出已保存");
  fixedDialog.value = false;
  loadData();
};

const deleteFixed = (item: any) => {
  Confirm.open({
    title: "删除固定支出",
    content: `确定删除【${item.name || "固定支出"}】吗？`,
    confirm: async () => {
      const bookId = localStorage.getItem("bookId");
      if (!bookId) return;
      await doApi.post("api/entry/fixedFlow/del", {
        id: item.id,
        bookId,
      });
      Alert.success("删除成功");
      loadData();
    },
  });
};

watch(selectedMonth, loadData);
onMounted(loadData);
</script>

<template>
  <div>
    <MobileV2PageHeader title="预算" subtitle="月度预算和固定支出" />
    <section class="space-y-4 px-4">
      <div class="rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
        <input v-model="selectedMonth" type="month" class="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-800 dark:bg-slate-950" />
      </div>

      <div class="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
        <div class="flex items-start justify-between">
          <div>
            <div class="text-xs text-slate-500">月度预算</div>
            <div class="mt-1 text-3xl font-bold text-slate-950 dark:text-white">{{ formatCurrency(totalBudget) }}</div>
          </div>
          <button class="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white" @click="openBudgetDialog">设置预算</button>
        </div>
        <div class="mt-4 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div class="h-full rounded-full bg-amber-500" :style="{ width: `${Math.min(usedPercent, 100)}%` }" />
        </div>
        <div class="mt-2 flex justify-between text-xs text-slate-500">
          <span>已用 {{ usedPercent }}%</span>
          <span>已用 {{ formatCurrency(usedAmount) }}</span>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <MobileV2StatCard label="固定支出" :value="formatCurrency(fixedTotal)" tone="warning" />
        <MobileV2StatCard label="可用额度" :value="formatCurrency(availableAmount)" tone="neutral" />
        <MobileV2StatCard label="已用额度" :value="formatCurrency(usedAmount)" tone="expense" />
        <MobileV2StatCard label="剩余额度" :value="formatCurrency(remainingAmount)" :tone="remainingAmount >= 0 ? 'income' : 'warning'" />
      </div>

      <div class="flex gap-2">
        <button class="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-white text-sm font-bold text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800" @click="reloadUsedAmount">
          <ArrowPathIcon class="h-5 w-5" />
          刷新额度
        </button>
        <button class="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 text-sm font-bold text-white" @click="openFixedDialog()">
          <PlusIcon class="h-5 w-5" />
          添加支出
        </button>
      </div>

      <section class="space-y-2">
        <h2 class="text-base font-bold">固定支出管理</h2>
        <div v-for="item in fixedFlows" :key="item.id" class="rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="truncate text-sm font-bold">{{ item.name || "未命名支出" }}</div>
              <div class="mt-1 text-xs text-slate-500">{{ item.attribution || "未归属" }} · {{ item.description || "无备注" }}</div>
            </div>
            <div class="text-right">
              <div class="text-sm font-bold text-rose-600">{{ formatCurrency(item.money) }}</div>
              <div class="mt-2 flex justify-end gap-2">
                <button class="text-xs font-semibold text-emerald-700" @click="openFixedDialog(item)">编辑</button>
                <button class="text-rose-500" @click="deleteFixed(item)"><TrashIcon class="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        </div>
        <MobileV2EmptyState v-if="!loading && fixedFlows.length === 0" title="暂无固定支出" />
      </section>
    </section>

    <Teleport to="body">
      <div v-if="budgetDialog || fixedDialog" class="fixed inset-0 z-50 mx-auto flex max-w-[430px] items-end bg-slate-950/50 p-4" @click="budgetDialog = false; fixedDialog = false">
        <div class="w-full rounded-t-2xl bg-[#FAFAF7] p-4 dark:bg-slate-950" @click.stop>
          <template v-if="budgetDialog">
            <h2 class="mb-4 text-lg font-bold">设置月度预算</h2>
            <input v-model="editBudget" type="number" inputmode="decimal" class="h-12 w-full rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900" placeholder="预算金额" />
            <button class="mt-4 h-12 w-full rounded-lg bg-emerald-600 font-bold text-white" @click="saveBudget">保存</button>
          </template>
          <template v-if="fixedDialog">
            <h2 class="mb-4 text-lg font-bold">{{ editFixed.id ? "编辑" : "添加" }}固定支出</h2>
            <div class="space-y-3">
              <div class="grid grid-cols-2 gap-2">
                <label class="block">
                  <span class="text-xs font-semibold text-slate-500">开始月份</span>
                  <input v-model="editFixed.startMonth" type="month" class="mt-1 h-12 w-full rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900" />
                </label>
                <label class="block">
                  <span class="text-xs font-semibold text-slate-500">结束月份</span>
                  <input v-model="editFixed.endMonth" type="month" class="mt-1 h-12 w-full rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900" />
                </label>
              </div>
              <input v-model="editFixed.name" class="h-12 w-full rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900" placeholder="名称" />
              <input v-model="editFixed.money" type="number" inputmode="decimal" class="h-12 w-full rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900" placeholder="金额" />
              <input v-model="editFixed.attribution" class="h-12 w-full rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900" placeholder="归属" />
              <textarea v-model="editFixed.description" rows="3" class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900" placeholder="备注" />
            </div>
            <button class="mt-4 h-12 w-full rounded-lg bg-emerald-600 font-bold text-white" @click="saveFixed">保存</button>
          </template>
        </div>
      </div>
    </Teleport>
  </div>
</template>
