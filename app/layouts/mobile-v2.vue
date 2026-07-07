<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useSystemStore } from "~/utils/store";

const systemStore = useSystemStore();
const { systemConfig } = storeToRefs(systemStore);
</script>

<template>
  <Head>
    <Title>{{ systemConfig?.title }}</Title>
    <Meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  </Head>

  <div class="min-h-screen bg-[#FAFAF7] text-slate-950 dark:bg-slate-950 dark:text-slate-50">
    <main class="mx-auto min-h-screen w-full max-w-[430px] pb-24">
      <slot />
    </main>
    <MobileV2BottomNav />
    <GlobalConfirm />
  </div>
</template>
