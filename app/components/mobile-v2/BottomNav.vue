<script setup lang="ts">
import {
  ChartBarIcon,
  HomeIcon,
  ListBulletIcon,
  PlusIcon,
  UserCircleIcon,
} from "@heroicons/vue/24/outline";

const route = useRoute();

const items = [
  { title: "首页", path: "/m/calendar", icon: HomeIcon },
  { title: "流水", path: "/m/flows", icon: ListBulletIcon },
  { title: "记账", path: "/m/calendar?quick=1", icon: PlusIcon, primary: true },
  { title: "分析", path: "/m/analysis", icon: ChartBarIcon },
  { title: "我的", path: "/m/settings", icon: UserCircleIcon },
];

const isActive = (path: string) => {
  if (path.includes("?quick=1")) return false;
  return route.path === path;
};
</script>

<template>
  <nav
    class="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[430px] border-t border-slate-200 bg-white/95 px-3 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/95"
  >
    <div class="grid grid-cols-5 items-end gap-1">
      <NuxtLink
        v-for="item in items"
        :key="item.title"
        :to="item.path"
        :class="[
          'flex h-12 flex-col items-center justify-center gap-0.5 rounded-lg text-xs font-medium transition-colors',
          item.primary
            ? '-mt-7 h-16 rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/25'
            : isActive(item.path)
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
              : 'text-slate-500 dark:text-slate-400',
        ]"
      >
        <component :is="item.icon" :class="item.primary ? 'h-7 w-7' : 'h-5 w-5'" />
        <span v-if="!item.primary">{{ item.title }}</span>
      </NuxtLink>
    </div>
  </nav>
</template>
