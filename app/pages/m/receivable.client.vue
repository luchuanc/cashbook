<script setup lang="ts">
import { CheckIcon, PlusIcon, TrashIcon } from "@heroicons/vue/24/outline";

definePageMeta({
  layout: "mobile-v2",
  middleware: ["auth"],
});

const loading = ref(false);
const dialog = ref(false);
const collectDialog = ref(false);
const statusFilter = ref("0");
const searchName = ref("");
const receivables = ref<any[]>([]);
const editItem = ref<any>({});
const collectItem = ref<any>({});

const stats = computed(() => {
  return receivables.value.reduce(
    (sum, item) => {
      if (item.status === 0) {
        sum.pending += 1;
        sum.pendingAmount += Number(item.money || 0);
      }
      if (item.status === 1) {
        sum.collected += 1;
        sum.collectedAmount += Number(item.money || 0);
      }
      return sum;
    },
    { pending: 0, pendingAmount: 0, collected: 0, collectedAmount: 0 }
  );
});

const formatCurrency = (value: number) => `¥${Number(value || 0).toFixed(2)}`;
const statusText = (status: number) => {
  const map: Record<number, string> = { 0: "未收款", 1: "已收款", [-1]: "不要了", [-2]: "已放弃", [-3]: "不可抗力" };
  return map[status] || "未知";
};

const overdueText = (item: any) => {
  if (item.status !== 0 || !item.expectDay) return "";
  const diff = Math.floor((Date.now() - new Date(item.expectDay).getTime()) / 86400000);
  return diff > 0 ? `逾期${diff}天` : "";
};

const loadData = async () => {
  const bookId = localStorage.getItem("bookId");
  if (!bookId) {
    receivables.value = [];
    return;
  }

  loading.value = true;
  try {
    const res = await doApi.post<{ total: number; datas: any[] }>("api/entry/receivable/list", {
      bookId,
      pageNum: 1,
      pageSize: 100,
      status: statusFilter.value === "" ? undefined : Number(statusFilter.value),
      name: searchName.value,
    });
    receivables.value = res?.datas || [];
  } finally {
    loading.value = false;
  }
};

const openDialog = (item?: any) => {
  editItem.value = item
    ? { ...item }
    : {
        occurDay: new Date().toISOString().slice(0, 10),
        status: 0,
      };
  dialog.value = true;
};

const saveReceivable = async () => {
  const bookId = localStorage.getItem("bookId");
  if (!bookId) return;
  const data = {
    ...editItem.value,
    bookId,
    money: Number(editItem.value.money || 0),
  };
  await doApi.post(editItem.value?.id ? "api/entry/receivable/update" : "api/entry/receivable/add", data);
  Alert.success("待收款已保存");
  dialog.value = false;
  loadData();
};

const openCollect = (item: any) => {
  collectItem.value = {
    ...item,
    actualDay: new Date().toISOString().slice(0, 10),
  };
  collectDialog.value = true;
};

const collect = async () => {
  const bookId = localStorage.getItem("bookId");
  if (!bookId) return;
  await doApi.post("api/entry/receivable/toflow", {
    id: collectItem.value.id,
    actualDay: collectItem.value.actualDay,
    bookId,
  });
  Alert.success("已转为收款流水");
  collectDialog.value = false;
  loadData();
};

const deleteReceivable = (item: any) => {
  Confirm.open({
    title: "删除待收款",
    content: `确定删除【${item.name || "待收款"}】吗？`,
    confirm: async () => {
      const bookId = localStorage.getItem("bookId");
      if (!bookId) return;
      await doApi.post("api/entry/receivable/del", {
        id: item.id,
        bookId,
      });
      Alert.success("删除成功");
      loadData();
    },
  });
};

watch(statusFilter, loadData);
onMounted(loadData);
</script>

<template>
  <div>
    <MobileV2PageHeader title="待收款" subtitle="管理借出、报销和应收款" />
    <section class="space-y-4 px-4">
      <div class="rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
        <div class="flex gap-2">
          <input v-model="searchName" class="h-11 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-800 dark:bg-slate-950" placeholder="搜索待收款名称" @keyup.enter="loadData" />
          <button class="h-11 rounded-lg bg-emerald-600 px-3 text-sm font-bold text-white" @click="openDialog()">添加</button>
        </div>
        <div class="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
          <button
            v-for="item in [{t:'全部',v:''},{t:'未收款',v:'0'},{t:'已收款',v:'1'},{t:'已放弃',v:'-2'}]"
            :key="item.v"
            :class="['h-9 shrink-0 rounded-lg px-3 text-sm font-semibold', statusFilter === item.v ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300']"
            @click="statusFilter = item.v"
          >
            {{ item.t }}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <MobileV2StatCard label="待收款项" :value="stats.pending" tone="warning" />
        <MobileV2StatCard label="待收金额" :value="formatCurrency(stats.pendingAmount)" tone="expense" />
        <MobileV2StatCard label="已收款项" :value="stats.collected" tone="income" />
        <MobileV2StatCard label="已收金额" :value="formatCurrency(stats.collectedAmount)" tone="income" />
      </div>

      <div v-if="loading" class="py-10 text-center text-sm text-slate-500">加载中...</div>
      <section v-else class="space-y-2">
        <div v-for="item in receivables" :key="item.id" class="rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="truncate text-sm font-bold">{{ item.name || "未命名待收款" }}</div>
              <div class="mt-1 text-xs text-slate-500">发生 {{ item.occurDay }} · 预计 {{ item.expectDay || "-" }}</div>
              <div v-if="item.description" class="mt-1 truncate text-xs text-slate-400">{{ item.description }}</div>
            </div>
            <div class="text-right">
              <div class="text-base font-bold text-emerald-700">{{ formatCurrency(item.money) }}</div>
              <div class="mt-1 flex justify-end gap-1">
                <span class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800">{{ statusText(item.status) }}</span>
                <span v-if="overdueText(item)" class="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] text-rose-600">{{ overdueText(item) }}</span>
              </div>
            </div>
          </div>
          <div class="mt-3 flex justify-end gap-2">
            <button class="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300" @click="openDialog(item)">编辑</button>
            <button v-if="item.status === 0" class="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white" @click="openCollect(item)">
              <CheckIcon class="h-4 w-4" />
              收款
            </button>
            <button class="rounded-lg bg-rose-50 px-2 text-rose-600" @click="deleteReceivable(item)">
              <TrashIcon class="h-4 w-4" />
            </button>
          </div>
        </div>
        <MobileV2EmptyState v-if="receivables.length === 0" title="暂无待收款" description="可以添加借款、报销或押金类应收款。" />
      </section>
    </section>

    <Teleport to="body">
      <div v-if="dialog || collectDialog" class="fixed inset-0 z-50 mx-auto flex max-w-[430px] items-end bg-slate-950/50 p-4" @click="dialog = false; collectDialog = false">
        <div class="w-full rounded-t-2xl bg-[#FAFAF7] p-4 dark:bg-slate-950" @click.stop>
          <template v-if="dialog">
            <h2 class="mb-4 text-lg font-bold">{{ editItem.id ? "编辑" : "添加" }}待收款</h2>
            <div class="space-y-3">
              <input v-model="editItem.name" class="h-12 w-full rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900" placeholder="名称" />
              <input v-model="editItem.money" type="number" inputmode="decimal" class="h-12 w-full rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900" placeholder="金额" />
              <input v-model="editItem.occurDay" type="date" class="h-12 w-full rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900" />
              <input v-model="editItem.expectDay" type="date" class="h-12 w-full rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900" />
              <textarea v-model="editItem.description" rows="3" class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900" placeholder="备注" />
            </div>
            <button class="mt-4 h-12 w-full rounded-lg bg-emerald-600 font-bold text-white" @click="saveReceivable">保存</button>
          </template>
          <template v-if="collectDialog">
            <h2 class="mb-4 text-lg font-bold">确认收款</h2>
            <input v-model="collectItem.actualDay" type="date" class="h-12 w-full rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900" />
            <button class="mt-4 h-12 w-full rounded-lg bg-emerald-600 font-bold text-white" @click="collect">转为收款流水</button>
          </template>
        </div>
      </div>
    </Teleport>
  </div>
</template>
