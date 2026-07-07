<script setup lang="ts">
import {
  ArrowRightIcon,
  MoonIcon,
  SunIcon,
} from "@heroicons/vue/24/outline";
import { storeToRefs } from "pinia";
import { useSystemStore } from "~/utils/store";

definePageMeta({
  layout: "mobile-v2",
  middleware: ["auth"],
});

const systemStore = useSystemStore();
const { globalUserInfo } = storeToRefs(systemStore);
const { isDark, toggleTheme } = useAppTheme();
const { switchUiMode } = useUiMode();
const bookName = ref("");
const passwordDialog = ref(false);
const changingPassword = ref(false);
const passwordForm = ref({
  old: "",
  new: "",
  againNew: "",
});

const groups = [
  {
    title: "账本与数据",
    items: [
      { title: "账本管理", path: "/m/books" },
      { title: "数据导入导出", action: "legacyFlows" },
      { title: "共享账本", path: "/m/books" },
    ],
  },
  {
    title: "记账配置",
    items: [
      { title: "预算管理", path: "/m/budget" },
      { title: "待收款", path: "/m/receivable" },
      { title: "类型管理", path: "/m/config" },
      { title: "默认记账项", path: "/m/config" },
      { title: "CSV 导入映射", path: "/m/config" },
    ],
  },
  {
    title: "系统",
    items: [
      { title: "修改密码", action: "changePassword" },
      { title: "后台管理", path: "/admin" },
      { title: "退出登录", action: "logout", danger: true },
    ],
  },
];

const go = (item: any) => {
  if (item.action === "logout") {
    localStorage.removeItem("Authorization");
    localStorage.removeItem("bookId");
    localStorage.removeItem("bookName");
    doApi.get("api/logout").finally(() => navigateTo("/m/login"));
    return;
  }
  if (item.action === "changePassword") {
    passwordDialog.value = true;
    return;
  }
  if (item.action === "legacyFlows") {
    switchUiMode("legacy", "/m/flows");
    return;
  }
  navigateTo(item.path);
};

const submitPassword = async () => {
  if (!passwordForm.value.old || !passwordForm.value.new || !passwordForm.value.againNew) {
    Alert.error("请填写完整信息");
    return;
  }
  if (passwordForm.value.new !== passwordForm.value.againNew) {
    Alert.error("两次密码不一致");
    return;
  }
  changingPassword.value = true;
  try {
    await doApi.post("api/entry/user/changePassword", passwordForm.value);
    Alert.success("密码修改成功");
    passwordDialog.value = false;
    passwordForm.value = { old: "", new: "", againNew: "" };
  } finally {
    changingPassword.value = false;
  }
};

onMounted(() => {
  bookName.value = localStorage.getItem("bookName") || "未选择账本";
});
</script>

<template>
  <div>
    <MobileV2PageHeader title="我的" subtitle="账号、账本和记账配置" />
    <section class="space-y-4 px-4">
      <div class="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
        <div class="flex items-center gap-3">
          <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-50 text-lg font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            {{ (globalUserInfo?.name || globalUserInfo?.username || "我").slice(0, 1) }}
          </div>
          <div class="min-w-0">
            <div class="truncate text-base font-bold">{{ globalUserInfo?.name || globalUserInfo?.username || "用户" }}</div>
            <div class="mt-1 truncate text-xs text-slate-500">当前账本：{{ bookName }}</div>
          </div>
        </div>
      </div>

      <div class="rounded-lg bg-emerald-50 p-4 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:ring-emerald-900">
        <div class="text-sm font-bold text-emerald-900 dark:text-emerald-100">当前使用：新版移动 UI</div>
        <p class="mt-1 text-xs text-emerald-700 dark:text-emerald-300">已记录到本地缓存，下次进入仍会使用新版。</p>
        <button class="mt-3 h-10 rounded-lg bg-white px-3 text-sm font-bold text-emerald-700 shadow-sm dark:bg-slate-900 dark:text-emerald-300" @click="switchUiMode('legacy')">
          切换到旧版 UI
        </button>
      </div>

      <div class="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
        <button class="flex w-full items-center justify-between" @click="toggleTheme()">
          <span class="text-sm font-bold">深色模式</span>
          <span class="flex items-center gap-2 text-sm text-slate-500">
            <SunIcon v-if="!isDark" class="h-5 w-5 text-amber-500" />
            <MoonIcon v-else class="h-5 w-5 text-emerald-400" />
            {{ isDark ? "已开启" : "未开启" }}
          </span>
        </button>
      </div>

      <section v-for="group in groups" :key="group.title" class="space-y-2">
        <h2 class="px-1 text-sm font-bold text-slate-500">{{ group.title }}</h2>
        <div class="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
          <button
            v-for="item in group.items"
            :key="item.title"
            class="flex h-12 w-full items-center justify-between border-b border-slate-100 px-4 text-left last:border-b-0 dark:border-slate-800"
            @click="go(item)"
          >
            <span :class="['text-sm font-semibold', item.danger ? 'text-rose-600' : 'text-slate-800 dark:text-slate-100']">{{ item.title }}</span>
            <ArrowRightIcon class="h-4 w-4 text-slate-400" />
          </button>
        </div>
      </section>
    </section>

    <Teleport to="body">
      <div v-if="passwordDialog" class="fixed inset-0 z-50 mx-auto flex max-w-[430px] items-end bg-slate-950/50 p-4" @click="passwordDialog = false">
        <div class="w-full rounded-t-2xl bg-[#FAFAF7] p-4 dark:bg-slate-950" @click.stop>
          <h2 class="mb-4 text-lg font-bold">修改密码</h2>
          <div class="space-y-3">
            <input v-model="passwordForm.old" type="password" autocomplete="current-password" class="h-12 w-full rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900" placeholder="原密码" />
            <input v-model="passwordForm.new" type="password" autocomplete="new-password" class="h-12 w-full rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900" placeholder="新密码" />
            <input v-model="passwordForm.againNew" type="password" autocomplete="new-password" class="h-12 w-full rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900" placeholder="再次输入新密码" />
          </div>
          <button class="mt-4 h-12 w-full rounded-lg bg-emerald-600 font-bold text-white disabled:opacity-60" :disabled="changingPassword" @click="submitPassword">
            {{ changingPassword ? "提交中..." : "确定修改" }}
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>
