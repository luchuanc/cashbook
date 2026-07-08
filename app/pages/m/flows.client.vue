<script setup lang="ts">
import { FunnelIcon, PlusIcon, TrashIcon } from "@heroicons/vue/24/outline";
import type { Page } from "~/utils/model";
import {
  exportCsv as exportCsvFile,
  exportJson as exportJsonFile,
} from "~/utils/fileUtils";
import FlowsImportDrawer from "@/components/flows/FlowsImportDrawer.vue";
import CsvFlowTable from "@/components/datas/CsvFlowTable.vue";
import FlowCustomImportDialog from "@/components/dialog/FlowCustomImport.vue";
import FlowJsonImportDialog from "@/components/dialog/FlowJsonImportDialog.vue";
import { showFlowExcelImportDialog, showFlowJsonImportDialog } from "~/utils/flag";
import * as XLSX from "xlsx";
import {
  alipayConvert,
  jdFinanceConvert,
  templateConvert,
  wxpayConvert,
} from "@/utils/flowConvert";

definePageMeta({
  layout: "mobile-v2",
  middleware: ["auth"],
});

const loading = ref(false);
const quickSheet = ref(false);
const importDrawer = ref(false);
const showFlowCustomImportDialog = ref(false);
const csvFileInput = ref<HTMLInputElement>();
const csvFlows = ref<any[]>([]);
const csvHeaders = ref<Record<string, number>>({});
const csvDatas = ref<any[][]>([]);
const fileType = ref("none");
const titleRowIndex = ref(0);
const flows = ref<any[]>([]);
const total = ref(0);
const query = ref({
  pageNum: 1,
  pageSize: 30,
  flowType: "",
  name: "",
  startDay: "",
  endDay: "",
});

const groupedFlows = computed(() => {
  return flows.value.reduce<Record<string, any[]>>((groups, item) => {
    const day = item.day || "未知日期";
    groups[day] ||= [];
    groups[day].push(item);
    return groups;
  }, {});
});

const summary = computed(() => {
  return flows.value.reduce(
    (sum, item) => {
      if (item.flowType === "收入") sum.in += Number(item.money || 0);
      if (item.flowType === "支出") sum.out += Number(item.money || 0);
      if (item.flowType === "不计收支") sum.zero += Number(item.money || 0);
      return sum;
    },
    { in: 0, out: 0, zero: 0 }
  );
});

const formatCurrency = (value: number) => `¥${Number(value || 0).toFixed(2)}`;

const removeFile = () => {
  csvFlows.value = [];
  csvHeaders.value = {};
  csvDatas.value = [];
  if (csvFileInput.value) csvFileInput.value.value = "";
};

const loadData = async () => {
  const bookId = localStorage.getItem("bookId");
  if (!bookId) {
    flows.value = [];
    total.value = 0;
    return;
  }

  loading.value = true;
  try {
    const res = await doApi.post<Page<any>>("api/entry/flow/page", {
      ...query.value,
      bookId,
    });
    flows.value = res?.data || [];
    total.value = res?.total || 0;
  } finally {
    loading.value = false;
  }
};

const setFlowType = (flowType: string) => {
  query.value.flowType = flowType;
  query.value.pageNum = 1;
  loadData();
};

const deleteFlow = (item: any) => {
  Confirm.open({
    title: "删除确认",
    content: `确定删除【${item.name || item.industryType || "这条流水"}】吗？`,
    confirm: async () => {
      const bookId = localStorage.getItem("bookId");
      if (!bookId) return;
      await doApi.post("api/entry/flow/del", {
        id: item.id,
        bookId,
      });
      Alert.success("删除成功");
      loadData();
    },
  });
};

const openCsvImport = (type: string) => {
  if (!csvFileInput.value) return;
  fileType.value = type;
  if (type === "alipay") titleRowIndex.value = 24;
  if (type === "wxpay") titleRowIndex.value = 17;
  if (type === "jdFinance") titleRowIndex.value = 21;
  importDrawer.value = false;
  csvFileInput.value.click();
};

const importCsvTemplate = () => {
  if (!csvFileInput.value) return;
  fileType.value = "template";
  titleRowIndex.value = 0;
  importDrawer.value = false;
  csvFileInput.value.click();
};

const readCsvInfo = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target?.files?.[0];
  if (!file) {
    removeFile();
    return;
  }

  const reader = new FileReader();
  reader.onload = (readerEvent) => {
    try {
      const buffer = readerEvent.target?.result;
      let workbook: XLSX.WorkBook;

      if (fileType.value === "alipay") {
        const context = new TextDecoder("gb2312").decode(buffer as ArrayBuffer);
        workbook = XLSX.read(context, { type: "string", codepage: 936 });
      } else {
        workbook = XLSX.read(buffer, { raw: true });
      }

      removeFile();

      const sheetName = workbook.SheetNames[0];
      const sheetData = XLSX.utils.sheet_to_json<any[]>(
        workbook.Sheets[sheetName] as XLSX.WorkSheet,
        {
          header: 1,
          defval: "",
          dateNF: "yyyy-mm-dd",
        }
      );

      const headerData = sheetData[titleRowIndex.value] || [];
      for (let i = 0; i < headerData.length; i++) {
        if (!headerData[i] || String(headerData[i]).trim() === "") continue;
        csvHeaders.value[String(headerData[i])] = i;
      }

      sheetData.splice(0, titleRowIndex.value + 1);
      const timeIndex = csvHeaders.value["交易时间"];
      sheetData.forEach((row) => {
        for (let i = 0; i < row.length; i++) {
          if (i !== timeIndex) continue;
          const cellValue = row[i];
          if (!cellValue) continue;

          if (typeof cellValue === "number" && cellValue > 0) {
            const excelStartDate = new Date(1899, 11, 30);
            const resultDate = new Date(excelStartDate);
            resultDate.setDate(resultDate.getDate() + cellValue);
            resultDate.setHours(resultDate.getHours() + 8);
            row[i] = resultDate.toISOString().split("T")[0];
          } else {
            const resultDate = new Date(cellValue);
            if (!Number.isNaN(resultDate.getTime())) {
              resultDate.setHours(resultDate.getHours() + 8);
              row[i] = resultDate.toISOString().split("T")[0];
            }
          }
        }

        csvDatas.value.push(row);
        if (fileType.value === "alipay") {
          csvFlows.value.push(alipayConvert(row, csvHeaders.value));
        } else if (fileType.value === "wxpay") {
          csvFlows.value.push(wxpayConvert(row, csvHeaders.value));
        } else if (fileType.value === "jdFinance") {
          csvFlows.value.push(jdFinanceConvert(row, csvHeaders.value));
        } else {
          csvFlows.value.push(templateConvert(row, csvHeaders.value));
        }
      });

      Alert.warning("数据解析完成，请预览并点击【确定导入】保存数据");
      showFlowExcelImportDialog.value = true;
    } catch (error) {
      console.error(error);
      Alert.error("数据解析出错了，请确认文件是否存在问题");
    }
  };

  reader.readAsArrayBuffer(file);
};

const importSuccess = () => {
  closeCsvTableDialog();
  loadData();
};

const closeCsvTableDialog = () => {
  showFlowExcelImportDialog.value = false;
  removeFile();
};

const showFlowCustomImport = () => {
  showFlowCustomImportDialog.value = true;
  importDrawer.value = false;
};

const closeCustomImport = () => {
  showFlowCustomImportDialog.value = false;
};

const openJsonImport = () => {
  showFlowJsonImportDialog.value = true;
  importDrawer.value = false;
};

const exportJson = () => {
  const bookId = localStorage.getItem("bookId");
  const bookName = localStorage.getItem("bookName") || "账本";
  if (!bookId) {
    Alert.error("请先选择账本");
    return;
  }

  doApi
    .post("api/entry/flow/list", {
      ...query.value,
      bookId,
    })
    .then((data) => {
      exportJsonFile(`${bookName}-${new Date().getTime()}.json`, JSON.stringify(data));
      Alert.success("导出成功");
      importDrawer.value = false;
    })
    .catch(() => Alert.error("数据获取出错，无法导出！"));
};

const exportCsv = () => {
  const bookId = localStorage.getItem("bookId");
  const bookName = localStorage.getItem("bookName") || "账本";
  if (!bookId) {
    Alert.error("请先选择账本");
    return;
  }

  doApi
    .post<any[]>("api/entry/flow/list", {
      ...query.value,
      bookId,
    })
    .then((data) => {
      exportCsvFile(`${bookName}-${new Date().getTime()}.csv`, data);
      Alert.success("导出成功");
      importDrawer.value = false;
    })
    .catch(() => Alert.error("数据获取出错，无法导出！"));
};

const downloadCsvTemplate = () => {
  const link = document.createElement("a");
  link.href = "/csvtemplate.csv";
  link.download = "Cashbook模板.csv";
  link.click();
  importDrawer.value = false;
};

onMounted(loadData);
</script>

<template>
  <div>
    <MobileV2PageHeader title="流水" subtitle="按日期查看和筛选账本流水" />

    <section class="space-y-4 px-4">
      <div class="rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
        <div class="flex gap-2">
          <input
            v-model="query.name"
            class="h-11 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-950"
            placeholder="搜索名称/备注"
            @keyup.enter="loadData"
          />
          <button class="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-900 text-white" @click="loadData">
            <FunnelIcon class="h-5 w-5" />
          </button>
        </div>
        <div class="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          <button
            v-for="item in ['', '支出', '收入', '不计收支']"
            :key="item || '全部'"
            type="button"
            :class="[
              'h-9 shrink-0 rounded-lg px-3 text-sm font-semibold',
              query.flowType === item ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
            ]"
            @click="setFlowType(item)"
          >
            {{ item || "全部" }}
          </button>
          <button class="h-9 shrink-0 rounded-lg bg-slate-100 px-3 text-sm font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300" @click="importDrawer = true">
            导入/导出
          </button>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <MobileV2StatCard label="收入" :value="formatCurrency(summary.in)" tone="income" />
        <MobileV2StatCard label="支出" :value="formatCurrency(summary.out)" tone="expense" />
      </div>

      <button class="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 text-sm font-bold text-white" @click="quickSheet = true">
        <PlusIcon class="h-5 w-5" />
        新增流水
      </button>

      <div v-if="loading" class="py-10 text-center text-sm text-slate-500">加载中...</div>
      <section v-for="(items, day) in groupedFlows" v-else :key="day" class="space-y-2">
        <div class="sticky top-[72px] z-20 bg-[#FAFAF7]/95 py-1 text-sm font-bold text-slate-500 backdrop-blur dark:bg-slate-950/95">
          {{ day }}
        </div>
        <MobileV2FlowListItem v-for="item in items" :key="item.id" :item="item">
          <template #action>
            <button class="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-500 dark:bg-rose-950/40" @click="deleteFlow(item)">
              <TrashIcon class="h-4 w-4" />
            </button>
          </template>
        </MobileV2FlowListItem>
      </section>

      <MobileV2EmptyState v-if="!loading && flows.length === 0" title="暂无流水" description="可以新增一笔，或调整筛选条件。" />
      <div v-if="total > flows.length" class="pb-4 text-center text-xs text-slate-400">
        当前显示 {{ flows.length }} / {{ total }} 条，可到旧版使用完整分页和批量操作。
      </div>
    </section>

    <MobileV2QuickFlowSheet :show="quickSheet" @close="quickSheet = false" @success="loadData" />
    <input ref="csvFileInput" type="file" accept=".csv,.xlsx" class="hidden" @change="readCsvInfo" />

    <FlowsImportDrawer
      :show="importDrawer"
      @close="importDrawer = false"
      @import-alipay="openCsvImport('alipay')"
      @import-wechat="openCsvImport('wxpay')"
      @import-jd="openCsvImport('jdFinance')"
      @custom-import="showFlowCustomImport"
      @import-json="openJsonImport"
      @export-json="exportJson"
      @export-csv="exportCsv"
      @download-template="downloadCsvTemplate"
      @import-template="importCsvTemplate"
    />

    <div
      v-if="showFlowExcelImportDialog"
      class="fixed inset-0 z-50 flex items-end bg-black/60 p-3"
      @click="closeCsvTableDialog"
    >
      <div
        class="flex max-h-[88vh] w-full flex-col rounded-t-2xl bg-white shadow-xl dark:bg-slate-900"
        @click.stop
      >
        <div class="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <h3 class="text-base font-bold text-slate-950 dark:text-white">CSV 流水导入</h3>
          <button class="rounded-lg px-2 py-1 text-sm font-semibold text-slate-500" @click="closeCsvTableDialog">关闭</button>
        </div>
        <div class="min-h-0 flex-1 overflow-hidden p-3">
          <CsvFlowTable
            :items="csvFlows"
            :table-head="csvHeaders"
            :table-body="csvDatas"
            :success-callback="importSuccess"
          />
        </div>
      </div>
    </div>

    <div
      v-if="showFlowCustomImportDialog"
      class="fixed inset-0 z-50 flex items-end bg-black/60 p-3"
      @click="closeCustomImport"
    >
      <div class="max-h-[88vh] w-full overflow-y-auto rounded-t-2xl bg-white dark:bg-slate-900" @click.stop>
        <FlowCustomImportDialog @success-callback="loadData" @close="closeCustomImport" />
      </div>
    </div>

    <FlowJsonImportDialog v-if="showFlowJsonImportDialog" :success-callback="loadData" />
  </div>
</template>
