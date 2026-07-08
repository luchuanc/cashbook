<script setup lang="ts">
import { MicrophoneIcon, PlusIcon } from "@heroicons/vue/24/outline";
import type { CommonChartData, Page } from "~/utils/model";
import { daily } from "~/utils/apis";
import { useVoiceRecorder } from "~/composables/useVoiceRecorder";

definePageMeta({
  layout: "mobile-v2",
  middleware: ["auth"],
});

const route = useRoute();
const bookName = ref("");
const quickSheet = ref(false);
const currentDate = ref(new Date());
const loading = ref(false);
const dailyData = ref<CommonChartData[]>([]);
const todayFlows = ref<any[]>([]);
const budgetInfo = ref<any>({});
const voiceActive = ref(false);
const voiceProcessing = ref(false);
const voiceTip = ref("长按语音记账");
const voicePrefill = ref<Record<string, any> | null>(null);
const recordStartTimer = ref<number | null>(null);
const voiceRecordStartedAt = ref(0);
const minVoiceRecordMs = 900;

const selectedDay = ref(new Date().toISOString().slice(0, 10));
const {
  isRecording,
  startRecording,
  stopRecording,
  cancelRecording,
  normalizeToPcm16kRaw,
  cleanup: cleanupRecorder,
} = useVoiceRecorder();

const currentMonthKey = computed(() => {
  const year = currentDate.value.getFullYear();
  const month = String(currentDate.value.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
});

const currentMonthTitle = computed(() => {
  return `${currentDate.value.getFullYear()}年${currentDate.value.getMonth() + 1}月`;
});

const monthStats = computed(() => {
  return dailyData.value.reduce(
    (sum, item) => {
      sum.in += Number(item.inSum || 0);
      sum.out += Number(item.outSum || 0);
      sum.zero += Number(item.zeroSum || 0);
      return sum;
    },
    { in: 0, out: 0, zero: 0 }
  );
});

const balance = computed(() => monthStats.value.in - monthStats.value.out);
const budgetTotal = computed(() => Number(budgetInfo.value?.budget || 0));
const budgetUsed = computed(() => Number(budgetInfo.value?.used || monthStats.value.out || 0));
const budgetPercent = computed(() => {
  if (budgetTotal.value <= 0) return 0;
  return Math.min(Math.round((budgetUsed.value / budgetTotal.value) * 100), 999);
});
const weekdays = ["一", "二", "三", "四", "五", "六", "日"];

const calendarDays = computed(() => {
  const firstDay = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth(), 1);
  const lastDay = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + 1, 0);
  const days: Array<{ day: number; date: string; inSum: number; outSum: number; current: boolean }> = [];
  const offset = firstDay.getDay() || 7;

  for (let i = 1; i < offset; i++) {
    days.push({ day: 0, date: "", inSum: 0, outSum: 0, current: false });
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = `${currentMonthKey.value}-${String(day).padStart(2, "0")}`;
    const matched = dailyData.value.find((item) => item.type === date);
    days.push({
      day,
      date,
      inSum: Number(matched?.inSum || 0),
      outSum: Number(matched?.outSum || 0),
      current: true,
    });
  }

  return days;
});

const formatCurrency = (value: number) => `¥${Number(value || 0).toFixed(2)}`;
const formatUnsignedCurrency = (value: number) => `¥${Math.abs(Number(value || 0)).toFixed(2)}`;
const formatCompactCurrency = (value: number) => {
  const amount = Number(value || 0);
  if (Math.abs(amount) >= 10000) return `${(amount / 10000).toFixed(1)}万`;
  return String(Math.round(amount));
};

const selectedDayStats = computed(() => {
  const matched = dailyData.value.find((item) => item.type === selectedDay.value);
  const inSum = Number(matched?.inSum || 0);
  const outSum = Number(matched?.outSum || 0);
  return {
    inSum,
    outSum,
    balance: inSum - outSum,
  };
});

const selectedDayTitle = computed(() => {
  const [, month, day] = selectedDay.value.split("-");
  if (!month || !day) return "今日";
  return `${Number(month)}月${Number(day)}日`;
});

const weekdayIndex = (index: number) => index % 7;

const flowBadgeClass = (flowType?: string) => {
  if (flowType === "收入") return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
  if (flowType === "支出") return "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300";
  return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
};

const flowAmountClass = (flowType?: string) => {
  if (flowType === "收入") return "text-emerald-600 dark:text-emerald-300";
  if (flowType === "支出") return "text-rose-600 dark:text-rose-300";
  return "text-slate-500 dark:text-slate-400";
};

const flowAmountText = (item: any) => {
  const amount = Number(item?.money || 0);
  if (amount === 0) return "";
  const money = amount.toFixed(2);
  if (item?.flowType === "收入") return `+¥${money}`;
  if (item?.flowType === "支出") return `-¥${money}`;
  return `¥${money}`;
};

const loadData = async () => {
  loading.value = true;
  try {
    const startDay = `${currentMonthKey.value}-01`;
    const endDay = `${currentMonthKey.value}-31`;
    const bookId = localStorage.getItem("bookId");
    if (!bookId) {
      dailyData.value = [];
      budgetInfo.value = {};
      todayFlows.value = [];
      return;
    }

    const [dailyRows, budgetRows] = await Promise.all([
      daily({ startDay, endDay }),
      doApi.post<any[]>("api/entry/budget/list", {
        bookId,
        month: currentMonthKey.value,
      }),
    ]);
    dailyData.value = dailyRows || [];
    budgetInfo.value = budgetRows?.[0] || {};
    await loadTodayFlows();
  } finally {
    loading.value = false;
  }
};

const loadTodayFlows = async () => {
  const bookId = localStorage.getItem("bookId");
  if (!bookId) {
    todayFlows.value = [];
    return;
  }

  const res = await doApi.post<Page<any>>("api/entry/flow/page", {
    bookId,
    startDay: selectedDay.value,
    endDay: selectedDay.value,
    pageNum: 1,
    pageSize: 5,
  });
  todayFlows.value = res?.data || [];
};

const changeMonth = (delta: number) => {
  currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + delta, 1);
  loadData();
};

const selectDay = (date: string) => {
  if (!date) return;
  selectedDay.value = date;
  loadTodayFlows();
};

const openQuickSheet = () => {
  voicePrefill.value = null;
  quickSheet.value = true;
};

const createFlowDirectly = async (draftFlow: any) => {
  return await doApi.post("api/entry/flow/add", {
    bookId: localStorage.getItem("bookId") || "",
    day: draftFlow.day || selectedDay.value,
    flowType: draftFlow.flowType || "支出",
    industryType: draftFlow.industryType || "",
    payType: draftFlow.payType || "",
    name: draftFlow.name || "",
    money: Number(draftFlow.money || 0),
    description: draftFlow.description || "",
    attribution: draftFlow.attribution || "",
    origin: "新版移动UI语音记账",
  });
};

const openVoiceConfirmSheet = (draftFlow: any) => {
  voicePrefill.value = {
    day: draftFlow.day || selectedDay.value,
    flowType: draftFlow.flowType || "支出",
    industryType: draftFlow.industryType || "",
    payType: draftFlow.payType || "",
    money: draftFlow.money || undefined,
    attribution: draftFlow.attribution || "",
    name: draftFlow.name || "",
    description: draftFlow.description || "",
  };
  quickSheet.value = true;
};

const parseVoiceFlow = async (voiceBlob: Blob) => {
  voiceProcessing.value = true;
  voiceTip.value = "正在识别...";
  try {
    const pcmBlob = await normalizeToPcm16kRaw(voiceBlob);
    const formData = new FormData();
    formData.append("audio", pcmBlob, "voice.pcm");
    formData.append("day", selectedDay.value);
    formData.append("bookId", localStorage.getItem("bookId") || "");

    const parsed = await doApi.postform<{
      transcript: string;
      draftFlow: any;
      needConfirm: boolean;
      autoSubmitRequested: boolean;
    }>("api/entry/flow/voice/parse", formData);

    const canAutoSubmit =
      !parsed.needConfirm &&
      parsed.autoSubmitRequested &&
      Number(parsed.draftFlow?.money || 0) > 0;

    if (canAutoSubmit) {
      await createFlowDirectly(parsed.draftFlow);
      await loadData();
      Alert.success("语音记账成功");
      return;
    }

    openVoiceConfirmSheet(parsed.draftFlow);
    Alert.success(parsed.needConfirm ? "已识别，请确认后保存" : "已识别，确认后保存");
  } catch (err: any) {
    Alert.error(err?.message || "语音识别失败");
  } finally {
    voiceProcessing.value = false;
    voiceActive.value = false;
    voiceTip.value = "长按语音记账";
  }
};

const startVoice = async (evt: PointerEvent) => {
  if (voiceProcessing.value || voiceActive.value) return;
  (evt.currentTarget as HTMLElement | null)?.setPointerCapture?.(evt.pointerId);

  voiceActive.value = true;
  voiceTip.value = "准备录音...";
  recordStartTimer.value = window.setTimeout(async () => {
    recordStartTimer.value = null;
    if (!localStorage.getItem("bookId")) {
      voiceActive.value = false;
      voiceTip.value = "长按语音记账";
      Alert.error("请先选择账本");
      return;
    }

    try {
      voiceTip.value = "录音中，松手结束";
      await startRecording();
      voiceRecordStartedAt.value = Date.now();
      if (!voiceActive.value) {
        await cancelRecording();
        voiceTip.value = "长按语音记账";
      }
    } catch (err: any) {
      voiceActive.value = false;
      voiceTip.value = "长按语音记账";
      Alert.error(err?.message || "录音启动失败");
    }
  }, 260);
};

const stopVoice = async () => {
  if (recordStartTimer.value) {
    clearTimeout(recordStartTimer.value);
    recordStartTimer.value = null;
  }

  if (!voiceActive.value) return;
  voiceActive.value = false;

  if (!isRecording.value) {
    voiceTip.value = "长按语音记账";
    return;
  }

  try {
    voiceTip.value = "正在处理...";
    if (Date.now() - voiceRecordStartedAt.value < minVoiceRecordMs) {
      await cancelRecording();
      voiceTip.value = "长按语音记账";
      Alert.error("按住时间太短，请长按说完后松手");
      return;
    }
    const audioBlob = await stopRecording();
    if (audioBlob.size > 0) {
      await parseVoiceFlow(audioBlob);
    }
  } catch (err: any) {
    Alert.error(err?.message || "录音处理失败");
    voiceTip.value = "长按语音记账";
  }
};

const cancelVoice = async () => {
  if (recordStartTimer.value) {
    clearTimeout(recordStartTimer.value);
    recordStartTimer.value = null;
  }

  if (!voiceActive.value) return;
  voiceActive.value = false;
  voiceTip.value = "长按语音记账";

  if (isRecording.value) {
    await cancelRecording();
  }
};

watch(
  () => route.query.quick,
  (quick) => {
    if (quick) openQuickSheet();
  },
  { immediate: true }
);

onMounted(() => {
  bookName.value = localStorage.getItem("bookName") || "未选择账本";
  loadData();
});

onBeforeUnmount(() => {
  cleanupRecorder();
});
</script>

<template>
  <div>
    <MobileV2PageHeader title="首页" :subtitle="bookName" />

    <section class="space-y-4 px-4">
      <div class="flex items-center justify-between px-1 py-1">
        <button class="flex h-10 w-10 items-center justify-center rounded-full text-2xl font-semibold text-slate-900 dark:text-white" @click="changeMonth(-1)">‹</button>
        <div class="text-2xl font-extrabold text-slate-950 dark:text-white">{{ currentMonthTitle }}</div>
        <button class="flex h-10 w-10 items-center justify-center rounded-full text-2xl font-semibold text-slate-900 dark:text-white" @click="changeMonth(1)">›</button>
      </div>

      <div class="overflow-hidden rounded-2xl bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)] ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
        <div class="grid grid-cols-3 divide-x divide-slate-100 text-center text-xs dark:divide-slate-800">
          <div class="px-2">
            <div class="text-slate-500">收入</div>
            <div class="mt-1 font-extrabold tabular-nums text-emerald-600">{{ formatCurrency(monthStats.in) }}</div>
          </div>
          <div class="px-2">
            <div class="text-slate-500">支出</div>
            <div class="mt-1 font-extrabold tabular-nums text-rose-600">{{ formatCurrency(monthStats.out) }}</div>
          </div>
          <div class="px-2">
            <div class="text-slate-500">结余</div>
            <div :class="['mt-1 font-extrabold tabular-nums', balance >= 0 ? 'text-slate-950 dark:text-white' : 'text-rose-600']">{{ formatUnsignedCurrency(balance) }}</div>
          </div>
        </div>

        <div v-if="budgetTotal > 0" class="mt-4 rounded-xl bg-white px-3 py-3 text-amber-800 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-amber-200 dark:ring-slate-800">
          <div class="flex items-center justify-between text-[11px] font-semibold">
            <span>预算使用 {{ budgetPercent }}%</span>
            <span>{{ formatCurrency(budgetUsed) }} / {{ formatCurrency(budgetTotal) }}</span>
          </div>
          <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-amber-100 dark:bg-amber-900">
            <div class="h-full rounded-full bg-amber-500" :style="{ width: `${Math.min(budgetPercent, 100)}%` }" />
          </div>
        </div>
      </div>

      <div class="overflow-hidden rounded-2xl bg-white p-3 shadow-[0_10px_30px_rgba(15,23,42,0.08)] ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
        <div class="grid grid-cols-7 text-center text-[13px] font-bold text-slate-500 dark:text-slate-400">
          <span v-for="item in weekdays" :key="item" class="py-2">{{ item }}</span>
        </div>
        <div class="grid grid-cols-7 auto-rows-[66px] gap-y-1">
          <button
            v-for="(item, index) in calendarDays"
            :key="`${item.date}-${index}`"
            type="button"
            :class="[
              'relative h-full overflow-hidden rounded-xl px-1 py-1.5 text-center transition dark:bg-slate-900',
              weekdayIndex(index) >= 5 && item.current ? 'bg-slate-50/60 dark:bg-slate-900/80' : '',
              item.date === selectedDay ? 'z-10 bg-emerald-50 ring-1 ring-inset ring-emerald-500 dark:bg-emerald-950/30' : '',
              !item.current ? 'pointer-events-none opacity-0' : '',
            ]"
            @click="selectDay(item.date)"
          >
            <span :class="['absolute left-1/2 top-1.5 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full text-sm font-semibold leading-none', item.date === selectedDay ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/25' : 'text-slate-950 dark:text-slate-100']">
              {{ item.day || "" }}
            </span>
            <span class="absolute inset-x-1 bottom-1.5 flex flex-col items-center gap-0.5">
              <span v-if="item.outSum" class="block max-w-full truncate rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none tabular-nums text-rose-600">
                {{ formatCompactCurrency(item.outSum) }}
              </span>
              <span v-if="item.inSum" class="block max-w-full truncate rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none tabular-nums text-emerald-600">
                {{ formatCompactCurrency(item.inSum) }}
              </span>
            </span>
          </button>
        </div>

        <div class="mt-3 grid grid-cols-3 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
          <div>
            <div class="text-slate-400">{{ selectedDayTitle }}支出</div>
            <div class="mt-0.5 font-extrabold tabular-nums text-rose-600">{{ formatCurrency(selectedDayStats.outSum) }}</div>
          </div>
          <div>
            <div class="text-slate-400">收入</div>
            <div class="mt-0.5 font-extrabold tabular-nums text-emerald-600">{{ formatCurrency(selectedDayStats.inSum) }}</div>
          </div>
          <div>
            <div class="text-slate-400">净额</div>
            <div :class="['mt-0.5 font-extrabold tabular-nums', selectedDayStats.balance >= 0 ? 'text-emerald-600' : 'text-amber-600']">
              {{ formatUnsignedCurrency(selectedDayStats.balance) }}
            </div>
          </div>
        </div>
      </div>

      <div class="flex gap-2">
        <button class="flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 text-sm font-bold text-white" @click="openQuickSheet">
          <PlusIcon class="h-5 w-5" />
          快速记账
        </button>
        <button
          :class="[
            'flex h-12 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-bold ring-1 transition',
            voiceActive || voiceProcessing
              ? 'bg-emerald-600 text-white ring-emerald-600'
              : 'bg-white text-emerald-700 ring-emerald-100 dark:bg-slate-900 dark:ring-emerald-900',
          ]"
          type="button"
          style="touch-action: none; user-select: none"
          @pointerdown.prevent="startVoice"
          @pointerup.prevent="stopVoice"
          @pointercancel.prevent="cancelVoice"
        >
          <MicrophoneIcon class="h-5 w-5" />
          {{ voiceTip }}
        </button>
      </div>

      <section class="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
        <div class="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <h2 class="text-base font-extrabold text-slate-950 dark:text-white">{{ selectedDayTitle }}流水</h2>
          <NuxtLink to="/m/flows" class="text-sm font-semibold text-emerald-700">全部</NuxtLink>
        </div>
        <div v-if="todayFlows.length > 0" class="divide-y divide-slate-100 dark:divide-slate-800">
          <div v-for="item in todayFlows" :key="item.id" class="flex items-center gap-3 px-4 py-3">
            <div :class="['flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold', flowBadgeClass(item.flowType)]">
              {{ (item.industryType || item.flowType || "账").slice(0, 1) }}
            </div>
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-bold text-slate-950 dark:text-white">{{ item.name || item.industryType || "未命名流水" }}</div>
              <div class="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                {{ item.industryType || "-" }} · {{ item.payType || "-" }} · {{ item.attribution || "未归属" }}
              </div>
            </div>
            <div :class="['shrink-0 text-right text-sm font-extrabold tabular-nums', flowAmountClass(item.flowType)]">{{ flowAmountText(item) }}</div>
          </div>
        </div>
        <MobileV2EmptyState v-if="!loading && todayFlows.length === 0" title="当天还没有流水" description="点“快速记账”记录一笔。" />
      </section>
    </section>

    <MobileV2QuickFlowSheet
      :show="quickSheet"
      :initial-day="selectedDay"
      :prefill="voicePrefill"
      @close="quickSheet = false"
      @success="loadData"
    />
  </div>
</template>
