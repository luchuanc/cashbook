<script setup lang="ts">
import { ClipboardIcon, PlusIcon, ShareIcon, TrashIcon } from "@heroicons/vue/24/outline";
import type { Page } from "~/utils/model";

definePageMeta({
  layout: "mobile-v2",
  middleware: ["auth"],
});

const loading = ref(false);
const books = ref<any[]>([]);
const queryName = ref("");
const dialog = ref(false);
const shareDialog = ref(false);
const editBook = ref<any>({});
const shareKey = ref("");
const currentBookId = ref("");

const loadData = async () => {
  loading.value = true;
  try {
    currentBookId.value = localStorage.getItem("bookId") || "";
    const res = await doApi.post<Page<any>>("api/entry/book/page", {
      pageNum: 1,
      pageSize: 100,
      bookName: queryName.value,
    });
    books.value = res?.data || [];
  } finally {
    loading.value = false;
  }
};

const openDialog = (item?: any) => {
  editBook.value = item ? { ...item } : {};
  dialog.value = true;
};

const saveBook = async () => {
  const path = editBook.value?.id ? "api/entry/book/update" : "api/entry/book/add";
  await doApi.post(path, editBook.value);
  Alert.success("账本已保存");
  dialog.value = false;
  loadData();
};

const switchBook = (item: any) => {
  localStorage.setItem("bookId", item.bookId);
  localStorage.setItem("bookName", item.bookName);
  currentBookId.value = item.bookId;
  Alert.success(`已切换到 ${item.bookName}`);
};

const shareBook = (item: any) => {
  Confirm.open({
    title: "分享账本",
    content: `确定要分享账本【${item.bookName}】吗？分享后无法取消分享。`,
    confirm: async () => {
      await doApi.post("api/entry/book/share", { id: item.id });
      Alert.success("分享成功");
      loadData();
    },
  });
};

const joinShare = async () => {
  if (!shareKey.value.trim()) {
    Alert.error("请输入分享 Key");
    return;
  }
  await doApi.post("api/entry/book/inshare", { key: shareKey.value.trim() });
  Alert.success("共享账本已添加");
  shareDialog.value = false;
  shareKey.value = "";
  loadData();
};

const copyKey = async (key: string) => {
  await navigator.clipboard.writeText(key);
  Alert.success("分享 Key 已复制");
};

const deleteBook = (item: any) => {
  Confirm.open({
    title: "删除账本",
    content: `确定删除账本【${item.bookName}】吗？`,
    confirm: async () => {
      await doApi.post("api/entry/book/del", { id: item.id });
      Alert.success("删除成功");
      loadData();
    },
  });
};

onMounted(loadData);
</script>

<template>
  <div>
    <MobileV2PageHeader title="账本" subtitle="管理个人和共享账本" />

    <section class="space-y-4 px-4">
      <div class="rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
        <div class="flex gap-2">
          <input v-model="queryName" class="h-11 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-800 dark:bg-slate-950" placeholder="搜索账本名称" @keyup.enter="loadData" />
          <button class="h-11 rounded-lg bg-slate-900 px-3 text-sm font-bold text-white" @click="loadData">查询</button>
        </div>
        <div class="mt-3 grid grid-cols-2 gap-2">
          <button class="flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 text-sm font-bold text-white" @click="openDialog()">
            <PlusIcon class="h-5 w-5" />
            新增账本
          </button>
          <button class="flex h-11 items-center justify-center gap-2 rounded-lg bg-white text-sm font-bold text-emerald-700 ring-1 ring-emerald-100 dark:bg-slate-900 dark:ring-emerald-900" @click="shareDialog = true">
            <ShareIcon class="h-5 w-5" />
            添加共享
          </button>
        </div>
      </div>

      <div v-if="loading" class="py-10 text-center text-sm text-slate-500">加载中...</div>
      <section v-else class="space-y-2">
        <div v-for="item in books" :key="item.id" class="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h2 class="truncate text-base font-bold">{{ item.bookName }}</h2>
                <span v-if="item.bookId === currentBookId" class="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">当前</span>
              </div>
              <div class="mt-1 text-xs text-slate-500">预算 {{ item.budget ? `¥${item.budget}` : "未设置" }}</div>
              <div v-if="item.shareKey" class="mt-2 flex items-center gap-1 text-xs text-slate-400">
                <span class="truncate">Key: {{ item.shareKey }}</span>
                <button class="text-emerald-700" @click="copyKey(item.shareKey)">
                  <ClipboardIcon class="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
          <div class="mt-4 grid grid-cols-4 gap-2">
            <button class="h-9 rounded-lg bg-emerald-600 text-xs font-bold text-white" @click="switchBook(item)">切换</button>
            <button class="h-9 rounded-lg bg-slate-100 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300" @click="openDialog(item)">编辑</button>
            <button class="h-9 rounded-lg bg-slate-100 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300" @click="shareBook(item)">分享</button>
            <button class="flex h-9 items-center justify-center rounded-lg bg-rose-50 text-rose-600" @click="deleteBook(item)">
              <TrashIcon class="h-4 w-4" />
            </button>
          </div>
        </div>
        <MobileV2EmptyState v-if="books.length === 0" title="暂无账本" description="可以新增账本或加入共享账本。" />
      </section>
    </section>

    <Teleport to="body">
      <div v-if="dialog || shareDialog" class="fixed inset-0 z-50 mx-auto flex max-w-[430px] items-end bg-slate-950/50 p-4" @click="dialog = false; shareDialog = false">
        <div class="w-full rounded-t-2xl bg-[#FAFAF7] p-4 dark:bg-slate-950" @click.stop>
          <template v-if="dialog">
            <h2 class="mb-4 text-lg font-bold">{{ editBook.id ? "编辑" : "新增" }}账本</h2>
            <div class="space-y-3">
              <input v-model="editBook.bookName" class="h-12 w-full rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900" placeholder="账本名称" />
              <input v-model="editBook.budget" type="number" inputmode="decimal" class="h-12 w-full rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900" placeholder="预算（选填）" />
            </div>
            <button class="mt-4 h-12 w-full rounded-lg bg-emerald-600 font-bold text-white" @click="saveBook">保存</button>
          </template>
          <template v-if="shareDialog">
            <h2 class="mb-4 text-lg font-bold">添加共享账本</h2>
            <input v-model="shareKey" class="h-12 w-full rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900" placeholder="请输入分享 Key" />
            <button class="mt-4 h-12 w-full rounded-lg bg-emerald-600 font-bold text-white" @click="joinShare">添加</button>
          </template>
        </div>
      </div>
    </Teleport>
  </div>
</template>
