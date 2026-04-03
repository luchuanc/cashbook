<template>
  <div class="p-2 md:p-4 bg-surface-muted dark:bg-surface-dark min-h-full">
    <div class="bg-surface dark:bg-surface-dark rounded-lg shadow-sm border border-frame dark:border-frame-dark p-6 max-w-2xl mx-auto mt-4">
      <h2 class="text-xl font-bold text-ink-primary dark:text-ink-onDark mb-6">默认类型管理</h2>
      <p class="text-sm text-ink-muted mb-6">在这里设置的选项将会在新增流水时作为默认选项填入，并且新增流水的其他不需要频繁修改的选项将被折叠。</p>

      <div class="space-y-6">
        <!-- 默认流水类型 -->
        <div>
          <label class="block text-sm font-medium text-ink-secondary dark:text-ink-onDark mb-2">默认流水类型</label>
          <select v-model="defaultSettings.flowType"
            @change="updatePayTypeOptions"
            class="w-full px-3 py-2 border border-frame dark:border-frame-dark rounded-lg bg-surface dark:bg-surface-dark text-ink-primary dark:text-ink-onDark focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors">
            <option value="">(无默认值)</option>
            <option v-for="option in flowTypeOptions" :key="option" :value="option">
              {{ option }}
            </option>
          </select>
        </div>

        <!-- 默认流水归属 -->
        <div>
          <label class="block text-sm font-medium text-ink-secondary dark:text-ink-onDark mb-2">默认流水归属</label>
          <select v-model="defaultSettings.attribution"
            class="w-full px-3 py-2 border border-frame dark:border-frame-dark rounded-lg bg-surface dark:bg-surface-dark text-ink-primary dark:text-ink-onDark focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors">
            <option value="">(无默认值)</option>
            <option v-for="option in attributionOptions" :key="option" :value="option">
              {{ option }}
            </option>
          </select>
        </div>

        <!-- 默认支付方式 -->
        <div>
          <label class="block text-sm font-medium text-ink-secondary dark:text-ink-onDark mb-2">默认支付方式</label>
          <select v-model="defaultSettings.payType"
            class="w-full px-3 py-2 border border-frame dark:border-frame-dark rounded-lg bg-surface dark:bg-surface-dark text-ink-primary dark:text-ink-onDark focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors">
            <option value="">(无默认值)</option>
            <option v-for="option in payTypeOptions" :key="option" :value="option">
              {{ option }}
            </option>
          </select>
        </div>

        <!-- 操作按钮 -->
        <div class="flex gap-4 pt-6 border-t border-frame dark:border-frame-dark">
          <button @click="saveSettings"
            class="px-6 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors duration-200 font-medium">
            保存设置
          </button>
          <button @click="clearSettings"
            class="px-6 py-2 bg-surface-muted hover:bg-surface-soft dark:bg-surface-darkMuted dark:hover:bg-surface-dark text-ink-secondary dark:text-ink-onDark rounded-lg transition-colors duration-200 font-medium">
            清除配置
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { getPayType } from "~/utils/apis";

definePageMeta({
  layout: "public",
  middleware: ["auth"],
});

const flowTypeOptions = ref(["支出", "收入", "不计收支"]);
const attributionOptions = ref<string[]>([]);
const payTypeOptions = ref<string[]>([]);

const defaultSettings = ref({
  flowType: "",
  attribution: "",
  payType: "",
});

const getBookId = () => {
  return localStorage.getItem("bookId") || "";
};

const updatePayTypeOptions = async () => {
  const data = await getPayType(defaultSettings.value.flowType || "");
  payTypeOptions.value = data.map((d) => d.payType);
};

const getAttributions = async () => {
  const res = await doApi.post<string[]>("api/entry/flow/getAttributions", {
    bookId: getBookId(),
  });
  attributionOptions.value = res;
};

onMounted(async () => {
  const bookId = getBookId();
  if (bookId) {
    defaultSettings.value.flowType = localStorage.getItem(`defaultFlowType_${bookId}`) || "";
    defaultSettings.value.attribution = localStorage.getItem(`defaultAttribution_${bookId}`) || "";
    defaultSettings.value.payType = localStorage.getItem(`defaultPayType_${bookId}`) || "";
    
    // 初始化选项列表
    await getAttributions();
    await updatePayTypeOptions();
  }
});

const saveSettings = () => {
  const bookId = getBookId();
  if (!bookId) {
    Alert.error("账本信息不存在，无法保存设置");
    return;
  }
  localStorage.setItem(`defaultFlowType_${bookId}`, defaultSettings.value.flowType);
  localStorage.setItem(`defaultAttribution_${bookId}`, defaultSettings.value.attribution);
  localStorage.setItem(`defaultPayType_${bookId}`, defaultSettings.value.payType);
  Alert.success("默认选项保存成功！");
};

const clearSettings = () => {
  const bookId = getBookId();
  if (!bookId) return;
  
  defaultSettings.value.flowType = "";
  defaultSettings.value.attribution = "";
  defaultSettings.value.payType = "";
  
  localStorage.removeItem(`defaultFlowType_${bookId}`);
  localStorage.removeItem(`defaultAttribution_${bookId}`);
  localStorage.removeItem(`defaultPayType_${bookId}`);
  Alert.success("配置已清除");
};
</script>
