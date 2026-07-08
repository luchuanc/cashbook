<script setup lang="ts">
import { PencilIcon } from "@heroicons/vue/24/outline";
import { getPayType } from "~/utils/apis";
import type { Typer } from "~/utils/model";

definePageMeta({
  layout: "mobile-v2",
  middleware: ["auth"],
});

const activeTab = ref<"types" | "defaults" | "mapping">("types");
const { switchUiMode } = useUiMode();
const loading = ref(false);
const types = ref<Typer[]>([]);
const typeQuery = ref({ type: "", value: "" });
const typeDialog = ref(false);
const editType = ref<any>({});

const defaultSettings = ref({
  flowType: "",
  attribution: "",
  payType: "",
});
const flowTypeOptions = ["支出", "收入", "不计收支"];
const attributionOptions = ref<string[]>([]);
const payTypeOptions = ref<string[]>([]);

const loadTypes = async () => {
  const bookId = localStorage.getItem("bookId");
  if (!bookId) {
    types.value = [];
    return;
  }

  loading.value = true;
  try {
    types.value = await doApi.post<Typer[]>("api/entry/flow/type/getAll", {
      ...typeQuery.value,
      bookId,
    });
  } finally {
    loading.value = false;
  }
};

const openTypeDialog = (item: Typer) => {
  const bookId = localStorage.getItem("bookId");
  editType.value = {
    type: item.type,
    oldValue: item.value,
    value: item.value,
    bookId,
  };
  typeDialog.value = true;
};

const saveType = async () => {
  if (!editType.value.bookId) return;
  await doApi.post("api/entry/flow/type/update", editType.value);
  Alert.success("类型已更新");
  typeDialog.value = false;
  loadTypes();
};

const loadDefaults = async () => {
  const bookId = localStorage.getItem("bookId");
  if (!bookId) {
    defaultSettings.value = { flowType: "", attribution: "", payType: "" };
    attributionOptions.value = [];
    payTypeOptions.value = [];
    return;
  }

  const [defaults, attrs] = await Promise.all([
    doApi.post<any>("api/entry/book/getDefaultTypes", { bookId }),
    doApi.post<string[]>("api/entry/flow/getAttributions", { bookId }),
  ]);
  defaultSettings.value.flowType = defaults?.flowType || "";
  defaultSettings.value.attribution = defaults?.attribution || "";
  defaultSettings.value.payType = defaults?.payType || "";
  attributionOptions.value = attrs || [];
  if (
    defaultSettings.value.attribution &&
    !attributionOptions.value.includes(defaultSettings.value.attribution)
  ) {
    attributionOptions.value = [defaultSettings.value.attribution, ...attributionOptions.value];
  }
  await loadPayOptions();
};

const loadPayOptions = async () => {
  const bookId = localStorage.getItem("bookId");
  if (!bookId) {
    payTypeOptions.value = [];
    return;
  }

  const rows = await getPayType(defaultSettings.value.flowType || "");
  payTypeOptions.value = (rows || []).map((item: any) => item.payType).filter(Boolean);
};

const saveDefaults = async () => {
  const bookId = localStorage.getItem("bookId");
  if (!bookId) return;
  await doApi.post("api/entry/book/updateDefaultTypes", {
    bookId,
    flowType: defaultSettings.value.flowType,
    attribution: defaultSettings.value.attribution,
    payType: defaultSettings.value.payType,
  });
  Alert.success("默认项已保存");
};

watch(
  () => defaultSettings.value.flowType,
  () => loadPayOptions()
);

onMounted(() => {
  loadTypes();
  loadDefaults();
});
</script>

<template>
  <div>
    <MobileV2PageHeader title="记账配置" subtitle="类型、默认项和 CSV 映射" />
    <section class="space-y-4 px-4">
      <div class="grid grid-cols-3 rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
        <button :class="['h-10 rounded-md text-sm font-bold', activeTab === 'types' ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-800 dark:text-emerald-300' : 'text-slate-500']" @click="activeTab = 'types'">类型管理</button>
        <button :class="['h-10 rounded-md text-sm font-bold', activeTab === 'defaults' ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-800 dark:text-emerald-300' : 'text-slate-500']" @click="activeTab = 'defaults'">默认项</button>
        <button :class="['h-10 rounded-md text-sm font-bold', activeTab === 'mapping' ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-800 dark:text-emerald-300' : 'text-slate-500']" @click="activeTab = 'mapping'">CSV映射</button>
      </div>

      <section v-if="activeTab === 'types'" class="space-y-3">
        <div class="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          修改类型名称会同步更新关联流水，请确认命名统一后再保存。
        </div>
        <div class="flex gap-2">
          <input v-model="typeQuery.value" class="h-11 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-900" placeholder="搜索类型名称" @keyup.enter="loadTypes" />
          <button class="h-11 rounded-lg bg-emerald-600 px-3 text-sm font-bold text-white" @click="loadTypes">查询</button>
        </div>
        <div v-if="loading" class="py-10 text-center text-sm text-slate-500">加载中...</div>
        <div v-for="item in types" v-else :key="`${item.type}-${item.value}`" class="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
          <div>
            <div class="text-sm font-bold">{{ item.value }}</div>
            <div class="mt-1 text-xs text-slate-500">分类：{{ item.type }}</div>
          </div>
          <button class="rounded-lg p-2 text-emerald-700" @click="openTypeDialog(item)">
            <PencilIcon class="h-5 w-5" />
          </button>
        </div>
      </section>

      <section v-if="activeTab === 'defaults'" class="space-y-4 rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
        <label class="block">
          <span class="text-sm font-semibold">默认流水类型</span>
          <select v-model="defaultSettings.flowType" class="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 dark:border-slate-800 dark:bg-slate-950">
            <option value="">无默认值</option>
            <option v-for="item in flowTypeOptions" :key="item" :value="item">{{ item }}</option>
          </select>
        </label>
        <label class="block">
          <span class="text-sm font-semibold">默认流水归属</span>
          <input
            v-model.trim="defaultSettings.attribution"
            list="mobile-default-attributions"
            class="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 dark:border-slate-800 dark:bg-slate-950"
            placeholder="输入归属，如个人、家庭"
          />
          <datalist id="mobile-default-attributions">
            <option v-for="item in attributionOptions" :key="item" :value="item" />
          </datalist>
        </label>
        <label class="block">
          <span class="text-sm font-semibold">默认支付方式</span>
          <select v-model="defaultSettings.payType" class="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 dark:border-slate-800 dark:bg-slate-950">
            <option value="">无默认值</option>
            <option v-for="item in payTypeOptions" :key="item" :value="item">{{ item }}</option>
          </select>
        </label>
        <button class="h-12 w-full rounded-lg bg-emerald-600 font-bold text-white" @click="saveDefaults">保存默认项</button>
      </section>

      <section v-if="activeTab === 'mapping'" class="space-y-3 rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
        <h2 class="text-base font-bold">CSV 导入映射配置</h2>
        <p class="text-sm leading-6 text-slate-500">
          移动端新版先提供配置入口。完整的映射表编辑和历史数据映射可切到旧版页面操作。
        </p>
        <button class="h-12 w-full rounded-lg bg-emerald-600 font-bold text-white" @click="switchUiMode('legacy', '/m/config')">前往旧版配置</button>
      </section>
    </section>

    <Teleport to="body">
      <div v-if="typeDialog" class="fixed inset-0 z-50 mx-auto flex max-w-[430px] items-end bg-slate-950/50 p-4" @click="typeDialog = false">
        <div class="w-full rounded-t-2xl bg-[#FAFAF7] p-4 dark:bg-slate-950" @click.stop>
          <h2 class="mb-2 text-lg font-bold">修改类型名称</h2>
          <p class="mb-4 text-xs text-amber-700">会同步更新关联流水。</p>
          <input v-model="editType.value" class="h-12 w-full rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900" />
          <button class="mt-4 h-12 w-full rounded-lg bg-emerald-600 font-bold text-white" @click="saveType">保存</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>
