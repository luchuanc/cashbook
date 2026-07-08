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
    const audioBlob = await stopRecording();
    if (audioBlob.size > 0) {
      await parseVoiceFlow(audioBlob);
    }
  } catch (err: any) {
    Alert.error(err?.message || "录音处理失败");
    voiceTip.value = "长按语音记账";
  }
};

watch(
  () => route.query.quick,
  (quick) => {
    if (quick === "1") openQuickSheet();
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
      <div class="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
        <div class="flex items-center justify-between">
          <button class="h-9 rounded-lg bg-slate-100 px-3 text-sm font-semibold dark:bg-slate-800" @click="changeMonth(-1)">上月</button>
          <div class="text-lg font-bold">{{ currentMonthTitle }}</div>
          <button class="h-9 rounded-lg bg-slate-100 px-3 text-sm font-semibold dark:bg-slate-800" @click="changeMonth(1)">下月</button>
        </div>

        <div class="mt-4 grid grid-cols-2 gap-2">
          <MobileV2StatCard label="本月收入" :value="formatCurrency(monthStats.in)" tone="income" />
          <MobileV2StatCard label="本月支出" :value="formatCurrency(monthStats.out)" tone="expense" />
        </div>

        <div class="mt-4 rounded-lg bg-amber-50 p-3 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <div class="flex items-center justify-between text-xs">
            <span>本月预算使用</span>
            <span>{{ budgetPercent }}%</span>
          </div>
          <div class="mt-2 h-2 overflow-hidden rounded-full bg-amber-100 dark:bg-amber-900">
            <div class="h-full rounded-full bg-amber-500" :style="{ width: `${Math.min(budgetPercent, 100)}%` }" />
          </div>
          <div class="mt-2 flex justify-between text-xs">
            <span>已用 {{ formatCurrency(budgetUsed) }}</span>
            <span>预算 {{ budgetTotal > 0 ? formatCurrency(budgetTotal) : "未设置" }}</span>
          </div>
        </div>
      </div>

      <div class="rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
        <div class="grid grid-cols-7 pb-2 text-center text-xs font-semibold text-slate-400">
          <span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span>
        </div>
        <div class="grid grid-cols-7 gap-1">
          <button
            v-for="(item, index) in calendarDays"
            :key="`${item.date}-${index}`"
            type="button"
            :class="[
              'min-h-12 rounded-lg p-1 text-center',
              item.date === selectedDay ? 'bg-emerald-600 text-white' : item.current ? 'bg-slate-50 dark:bg-slate-800' : 'opacity-0',
            ]"
            @click="selectDay(item.date)"
          >
            <div class="text-xs font-semibold">{{ item.day || "" }}</div>
            <div v-if="item.outSum || item.inSum" class="mt-1 flex justify-center gap-1">
              <span v-if="item.inSum" class="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span v-if="item.outSum" class="h-1.5 w-1.5 rounded-full bg-rose-400" />
            </div>
          </button>
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
          @pointerdown.prevent="startVoice"
          @pointerup.prevent="stopVoice"
          @pointercancel.prevent="stopVoice"
          @pointerleave.prevent="stopVoice"
        >
          <MicrophoneIcon class="h-5 w-5" />
          {{ voiceTip }}
        </button>
      </div>

      <section class="space-y-2">
        <div class="flex items-center justify-between">
          <h2 class="text-base font-bold">今日流水</h2>
          <NuxtLink to="/m/flows" class="text-sm font-semibold text-emerald-700">全部</NuxtLink>
        </div>
        <MobileV2FlowListItem v-for="item in todayFlows" :key="item.id" :item="item" />
        <MobileV2EmptyState v-if="!loading && todayFlows.length === 0" title="今天还没有流水" description="点“快速记账”记录一笔。" />
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
