<script setup lang="ts">
import { XMarkIcon } from "@heroicons/vue/24/outline";
import { getIndustryType, getPayType } from "~/utils/apis";

const props = defineProps<{
  show: boolean;
  initialDay?: string;
  prefill?: Record<string, any> | null;
}>();

const emit = defineEmits<{
  close: [];
  success: [];
}>();

const flowTypeOptions = ["支出", "收入", "不计收支"];
const expanded = ref(false);
const saving = ref(false);
const hydrating = ref(false);
const industryOptions = ref<string[]>([]);
const payOptions = ref<string[]>([]);
const attributionOptions = ref<string[]>([]);
const defaultSettings = ref({
  flowType: "",
  attribution: "",
  payType: "",
});

const createDefaultForm = () => ({
  day: new Date().toISOString().slice(0, 10),
  flowType: "支出",
  industryType: "",
  payType: "",
  money: undefined,
  attribution: "",
  name: "",
  description: "",
});

const form = ref<any>(createDefaultForm());

const amountToneClass = computed(() => {
  if (form.value.flowType === "收入") return "text-emerald-600";
  if (form.value.flowType === "支出") return "text-rose-600";
  return "text-slate-700";
});

const loadDefaultSettings = async (bookId: string) => {
  const defaults = await doApi.post<any>("api/entry/book/getDefaultTypes", { bookId });
  defaultSettings.value = {
    flowType: defaults?.flowType || "",
    attribution: defaults?.attribution || "",
    payType: defaults?.payType || "",
  };
};

const loadOptions = async () => {
  const bookId = localStorage.getItem("bookId");
  if (!bookId) {
    industryOptions.value = [];
    payOptions.value = [];
    attributionOptions.value = [];
    defaultSettings.value = { flowType: "", attribution: "", payType: "" };
    return;
  }

  const [industries, pays, attributions] = await Promise.all([
    getIndustryType(form.value.flowType || ""),
    getPayType(form.value.flowType || ""),
    doApi.post<string[]>("api/entry/flow/getAttributions", {
      bookId,
    }),
  ]);
  industryOptions.value = (industries || []).map((item: any) => item.industryType).filter(Boolean);
  payOptions.value = (pays || []).map((item: any) => item.payType).filter(Boolean);
  attributionOptions.value = attributions || [];
  form.value.industryType ||= industryOptions.value[0] || "";
  form.value.payType ||= defaultSettings.value.payType || payOptions.value[0] || "";
  form.value.attribution ||= defaultSettings.value.attribution || attributionOptions.value[0] || "";
};

const syncFormFromProps = async () => {
  hydrating.value = true;
  const bookId = localStorage.getItem("bookId");
  if (bookId) {
    await loadDefaultSettings(bookId);
  }
  const defaults = defaultSettings.value;
  const prefill = props.prefill || {};
  form.value = {
    ...createDefaultForm(),
    day: props.initialDay || new Date().toISOString().slice(0, 10),
    flowType: prefill.flowType || defaults.flowType || "支出",
    payType: prefill.payType || defaults.payType || "",
    attribution: prefill.attribution || defaults.attribution || "",
    ...prefill,
  };
  if (form.value.money !== undefined && form.value.money !== null && form.value.money !== "") {
    form.value.money = Number(form.value.money);
  }
  expanded.value = Boolean(
    form.value.name || form.value.description
  );
  await loadOptions();
  hydrating.value = false;
};

watch(
  () => props.show,
  (show) => {
    if (show) {
      syncFormFromProps();
    }
  },
  { immediate: true }
);

watch(
  () => props.prefill,
  () => {
    if (props.show) syncFormFromProps();
  }
);

watch(
  () => form.value.flowType,
  () => {
    if (hydrating.value) return;
    form.value.industryType = "";
    form.value.payType = "";
    loadOptions();
  }
);

const save = async (keepOpen = false) => {
  const bookId = localStorage.getItem("bookId");
  if (!bookId) {
    Alert.error("请先选择账本");
    return;
  }
  if (!form.value.money || Number(form.value.money) <= 0) {
    Alert.error("请输入金额");
    return;
  }
  saving.value = true;
  try {
    await doApi.post("api/entry/flow/add", {
      ...form.value,
      money: Number(form.value.money),
      bookId,
      origin: "新版移动UI手动记账",
    });
    Alert.success("记账成功");
    emit("success");
    form.value.money = undefined;
    form.value.name = "";
    form.value.description = "";
    if (!keepOpen) emit("close");
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <Teleport to="body">
    <Transition name="mobile-sheet-fade">
      <div v-if="show" class="fixed inset-0 z-50 mx-auto max-w-[430px] bg-slate-950/50" @click="emit('close')">
        <Transition name="mobile-sheet-slide" appear>
          <section
            class="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-2xl bg-[#FAFAF7] p-4 pb-[max(env(safe-area-inset-bottom),16px)] shadow-2xl dark:bg-slate-950"
            @click.stop
          >
        <div class="mx-auto mb-3 h-1 w-12 rounded-full bg-slate-300 dark:bg-slate-700" />
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-lg font-bold text-slate-950 dark:text-white">记一笔</h2>
          <button class="rounded-lg p-2 text-slate-500" @click="emit('close')">
            <XMarkIcon class="h-5 w-5" />
          </button>
        </div>

        <div class="grid grid-cols-3 gap-2 rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
          <button
            v-for="type in flowTypeOptions"
            :key="type"
            type="button"
            :class="[
              'h-10 rounded-md text-sm font-semibold',
              form.flowType === type ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-800 dark:text-emerald-300' : 'text-slate-500',
            ]"
            @click="form.flowType = type"
          >
            {{ type }}
          </button>
        </div>

        <label class="mt-5 block text-xs font-semibold text-slate-500">金额</label>
        <div class="mt-1 flex items-center border-b border-slate-200 pb-2 dark:border-slate-800">
          <span :class="['text-3xl font-bold', amountToneClass]">¥</span>
          <input
            v-model="form.money"
            type="number"
            inputmode="decimal"
            placeholder="0.00"
            class="min-w-0 flex-1 bg-transparent px-2 text-4xl font-bold text-slate-950 outline-none placeholder:text-slate-300 dark:text-white"
          />
        </div>

        <div class="mt-5">
          <label class="block">
            <span class="text-xs font-semibold text-slate-500">日期</span>
            <input v-model="form.day" type="date" class="mt-1 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-900" />
          </label>
        </div>

        <div class="mt-5 space-y-4">
          <div>
            <div class="mb-2 text-xs font-semibold text-slate-500">{{ form.flowType === '收入' ? '收入类型' : '支出类型' }}</div>
            <div class="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              <button
                v-for="item in industryOptions"
                :key="item"
                type="button"
                :class="['h-9 shrink-0 rounded-lg px-3 text-sm font-medium', form.industryType === item ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800']"
                @click="form.industryType = item"
              >
                {{ item }}
              </button>
            </div>
          </div>
          <div>
            <div class="mb-2 text-xs font-semibold text-slate-500">{{ form.flowType === '收入' ? '收款方式' : '支付方式' }}</div>
            <div class="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              <button
                v-for="item in payOptions"
                :key="item"
                type="button"
                :class="['h-9 shrink-0 rounded-lg px-3 text-sm font-medium', form.payType === item ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800']"
                @click="form.payType = item"
              >
                {{ item }}
              </button>
            </div>
          </div>
        </div>

        <button class="mt-4 w-full text-sm font-semibold text-emerald-700" type="button" @click="expanded = !expanded">
          {{ expanded ? "收起更多信息" : "更多信息" }}
        </button>

        <div v-if="expanded" class="mt-3 space-y-3">
          <input v-model="form.name" placeholder="名称，如早餐、工资" class="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-900" />
          <select v-model="form.attribution" class="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-900">
            <option value="">选择归属</option>
            <option v-for="item in attributionOptions" :key="item" :value="item">{{ item }}</option>
          </select>
          <textarea v-model="form.description" rows="3" placeholder="备注" class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900" />
        </div>

        <div class="mt-5 grid grid-cols-2 gap-3">
          <button type="button" class="h-12 rounded-lg bg-slate-900 text-sm font-bold text-white disabled:opacity-60" :disabled="saving" @click="save(false)">保存</button>
          <button type="button" class="h-12 rounded-lg bg-emerald-600 text-sm font-bold text-white disabled:opacity-60" :disabled="saving" @click="save(true)">保存并继续</button>
        </div>
          </section>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
