<script setup lang="ts">
import {
  Cog6ToothIcon,
  EyeIcon,
  EyeSlashIcon,
  MoonIcon,
  SunIcon,
} from "@heroicons/vue/24/outline";
import { storeToRefs } from "pinia";
import { useSystemStore } from "~/utils/store";
import { checkSignIn } from "~/utils/common";
import type { UserInfo } from "~/utils/model";

definePageMeta({
  unauthenticatedOnly: true,
  layout: "default",
});

const systemStore = useSystemStore();
const { systemConfig } = storeToRefs(systemStore);
const { isDark, toggleTheme } = useAppTheme();

const route = useRoute();
const fromUrl = computed(() => {
  const callbackUrl = route.query.callbackUrl as string | undefined;
  return callbackUrl && callbackUrl !== route.path ? callbackUrl : "/m/calendar";
});

const openRegister = computed(() => Boolean(systemConfig.value?.openRegister));
const registerMode = ref(false);
const showPassword = ref(false);

const loginParam = ref({ username: "", password: "" });
const registerParam = ref({
  name: "",
  username: "",
  password: "",
  againPassword: "",
});

const errors = ref<Record<string, string>>({});

const validateLogin = () => {
  errors.value = {};
  if (!loginParam.value.username) errors.value.username = "请输入账号";
  if (!loginParam.value.password) errors.value.password = "请输入密码";
  return Object.keys(errors.value).length === 0;
};

const validateRegister = () => {
  errors.value = {};
  if (!registerParam.value.username) errors.value.username = "请输入账号";
  if (!registerParam.value.password) errors.value.password = "请输入密码";
  if (registerParam.value.password.length > 0 && registerParam.value.password.length < 8) {
    errors.value.password = "密码至少 8 位";
  }
  if (registerParam.value.againPassword !== registerParam.value.password) {
    errors.value.againPassword = "两次密码不一致";
  }
  return Object.keys(errors.value).length === 0;
};

const login = async () => {
  if (!validateLogin()) return;
  const res = await doApi.post<UserInfo & { token?: string }>("api/login", loginParam.value);
  if (res.token) {
    localStorage.setItem("Authorization", res.token);
  }
  setUiMode("mobile-v2");
  Alert.success("登录成功");
  window.location.href = fromUrl.value;
};

const register = async () => {
  if (!validateRegister()) return;
  await doApi.post<UserInfo>("api/register", registerParam.value);
  Alert.success("注册成功，请登录");
  loginParam.value.username = registerParam.value.username;
  loginParam.value.password = registerParam.value.password;
  registerMode.value = false;
};

onMounted(() => {
  setUiMode("mobile-v2");
  if (checkSignIn()) {
    navigateTo(fromUrl.value);
  }
});
</script>

<template>
  <div
    :class="[
      'min-h-screen bg-[#FAFAF7] px-6 pb-10 pt-[max(env(safe-area-inset-top),16px)] text-slate-950 transition-colors dark:bg-slate-950 dark:text-white',
      isDark ? 'dark' : '',
    ]"
  >
    <div class="mx-auto flex min-h-screen max-w-[390px] flex-col">
      <div class="flex items-center justify-between gap-2">
        <button
          v-if="registerMode"
          type="button"
          class="h-10 rounded-lg bg-white px-4 text-sm font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800"
          @click="registerMode = false"
        >
          登录
        </button>
        <div v-else class="h-10" />

        <div class="flex gap-2">
          <button
            type="button"
            class="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800"
            @click="toggleTheme()"
          >
            <SunIcon v-if="isDark" class="h-5 w-5" />
            <MoonIcon v-else class="h-5 w-5" />
          </button>
          <NuxtLink
            to="/admin"
            class="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800"
          >
            <Cog6ToothIcon class="h-5 w-5" />
          </NuxtLink>
        </div>
      </div>

      <div class="flex flex-1 flex-col justify-center pb-28">
        <div class="mb-9 text-center">
          <img src="/logo.png" alt="Cashbook" class="mx-auto h-16 w-16 rounded-2xl" />
          <div class="mt-4 text-2xl font-bold">Cashbook</div>
          <h1 class="mt-8 text-3xl font-bold tracking-normal">
            {{ registerMode ? "创建账号" : "欢迎回来" }}
          </h1>
          <p class="mt-2 text-sm text-slate-500">
            {{ registerMode ? "开始记录你的第一笔收支" : "继续记录今天的收支" }}
          </p>
        </div>

        <form v-if="!registerMode" class="space-y-4" @submit.prevent="login">
          <label class="block">
            <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">账号</span>
            <input
              v-model="loginParam.username"
              autocomplete="username"
              class="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-white px-4 text-base outline-none focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-900"
              placeholder="请输入账号"
            />
            <span v-if="errors.username" class="mt-1 block text-xs text-rose-600">{{ errors.username }}</span>
          </label>

          <label class="block">
            <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">密码</span>
            <div class="mt-2 flex h-12 items-center rounded-lg border border-slate-200 bg-white px-4 focus-within:border-emerald-500 dark:border-slate-800 dark:bg-slate-900">
              <input
                v-model="loginParam.password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                class="min-w-0 flex-1 bg-transparent text-base outline-none"
                placeholder="请输入密码"
              />
              <button type="button" class="text-slate-400" @click="showPassword = !showPassword">
                <EyeSlashIcon v-if="showPassword" class="h-5 w-5" />
                <EyeIcon v-else class="h-5 w-5" />
              </button>
            </div>
            <span v-if="errors.password" class="mt-1 block text-xs text-rose-600">{{ errors.password }}</span>
          </label>

          <button class="h-12 w-full rounded-lg bg-emerald-600 text-base font-bold text-white shadow-lg shadow-emerald-600/20" type="submit">
            登录
          </button>
          <button
            v-if="openRegister"
            class="h-11 w-full rounded-lg bg-white text-sm font-semibold text-emerald-700 ring-1 ring-emerald-100 dark:bg-slate-900 dark:text-emerald-300 dark:ring-emerald-900"
            type="button"
            @click="registerMode = true"
          >
            注册账号
          </button>
        </form>

        <form v-else class="space-y-4" @submit.prevent="register">
          <input v-model="registerParam.name" class="h-12 w-full rounded-lg border border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900" placeholder="昵称（选填）" />
          <input v-model="registerParam.username" autocomplete="username" class="h-12 w-full rounded-lg border border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900" placeholder="账号" />
          <input v-model="registerParam.password" type="password" autocomplete="new-password" class="h-12 w-full rounded-lg border border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900" placeholder="密码，至少 8 位" />
          <input v-model="registerParam.againPassword" type="password" autocomplete="new-password" class="h-12 w-full rounded-lg border border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900" placeholder="再次输入密码" />
          <div v-if="Object.keys(errors).length" class="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            {{ Object.values(errors)[0] }}
          </div>
          <button class="h-12 w-full rounded-lg bg-emerald-600 text-base font-bold text-white" type="submit">注册</button>
        </form>
      </div>
    </div>
  </div>
</template>
