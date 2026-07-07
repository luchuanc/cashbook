# 移动端新版 UI 实施方案

## 总体策略

采用旁路新增方案，不在原页面上直接重构移动端 UI。

旧 UI 保持现有路由和页面不变。新版移动 UI 新增独立路由、独立布局、独立组件目录，通过本地缓存控制默认进入哪套 UI。

## 推荐目录结构

```text
app/
  composables/
    useUiMode.ts
  middleware/
    ui-mode.global.client.ts
  layouts/
    mobile-v2.vue
  pages/
    m/
      login.vue
      index.vue
      calendar.client.vue
      flows.client.vue
      analysis.client.vue
      budget.client.vue
      receivable.client.vue
      books.client.vue
      settings.client.vue
      config.client.vue
  components/
    mobile-v2/
      BottomNav.vue
      PageHeader.vue
      QuickFlowSheet.vue
      FlowListItem.vue
      StatCard.vue
      EmptyState.vue
```

说明：

- `app/pages/m/*` 为新版移动 UI 路由。
- 旧 UI 继续使用现有 `/calendar`、`/flows`、`/analysis` 等路由。
- 新 UI 组件集中放在 `app/components/mobile-v2/`，避免污染现有组件。
- 通用 API 调用可以复用现有 `doApi`、`utils/apis`、`utils/model`、`FlowEditDialog` 内已有的数据规则，但 UI 组件重新组织。

## 路由映射

| 旧 UI | 新 UI | 页面 |
| --- | --- | --- |
| `/calendar` | `/m/calendar` | 首页/账本日历 |
| `/flows` | `/m/flows` | 流水 |
| `/analysis` | `/m/analysis` | 分析 |
| `/budget` | `/m/budget` | 预算 |
| `/receivable` | `/m/receivable` | 待收款 |
| `/books` | `/m/books` | 账本 |
| `/types`、`/default-types` | `/m/config` | 记账配置 |
| 侧边栏用户菜单 | `/m/settings` | 我的/设置 |
| `/login` | `/m/login` | 登录/注册 |

已新增 `/m/login` 作为新版移动端登录/注册页。旧版 `/login` 保持可直接访问；鉴权失效时会根据 `cashbook.ui.mode` 跳转到 `/login` 或 `/m/login`。

## UI 模式缓存设计

新增组合式函数：

```ts
const UI_MODE_KEY = "cashbook.ui.mode";
type UiMode = "legacy" | "mobile-v2";
```

职责：

- `getUiMode()`：从 `localStorage` 读取模式，默认 `legacy`。
- `setUiMode(mode)`：写入 `localStorage`。
- `switchUiMode(mode, currentPath)`：写入模式后，根据路由映射跳转到对应页面。
- `toPairedPath(mode, currentPath)`：根据当前路径返回新旧 UI 对应路径。

## 自动进入上次 UI

新增 client middleware：`app/middleware/ui-mode.global.client.ts`。

建议规则：

- 只处理已登录前台页面，不处理 `/login`、`/m/login`、`/admin`、`/api-docs`、`/500` 等非前台业务页。
- 当前缓存为 `mobile-v2` 且访问旧路由时，跳到对应 `/m/*`。
- 当前缓存为 `legacy` 且访问 `/m/*` 时，跳到对应旧路由。
- 未命中映射时不处理，避免误伤。

伪代码：

```ts
export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return;
  const mode = localStorage.getItem("cashbook.ui.mode") || "legacy";
  const target = getPairedRoute(mode, to.path);
  if (target && target !== to.path) {
    return navigateTo(target, { replace: true });
  }
});
```

## 切换入口设计

### 旧 UI 入口

在 `app/layouts/public.vue` 或 `LayoutAppHeader` 用户菜单中增加：

- 文案：`切换到新版移动 UI`
- 行为：`setUiMode("mobile-v2")` 后跳转到当前页面的新 UI 对应路由。

为了入口更明显，移动端顶部也可以展示一个小按钮：`新版UI`。

### 新 UI 入口

在 `mobile-v2` 布局顶部或“我的/设置”页中增加：

- 文案：`切换到旧版 UI`
- 行为：`setUiMode("legacy")` 后跳转到旧 UI 对应路由。

每个新 UI 页面顶部建议保留轻量入口，避免用户进入新 UI 后找不到返回旧 UI 的方式。

## 分阶段实施

### 阶段 1：基础并存框架

- 新增 `useUiMode.ts`。
- 新增新旧 UI 路由映射。
- 新增 `ui-mode.global.client.ts`。
- 新增 `mobile-v2.vue` 布局。
- 在旧 UI 增加“切换到新版移动 UI”入口。
- 在新 UI 布局增加“切换到旧版 UI”入口。

验收：

- 从旧 UI 切换到新 UI 后，刷新仍停留在新 UI。
- 从新 UI 切回旧 UI 后，刷新仍停留在旧 UI。
- 未设置缓存的新用户默认进入旧 UI。

### 阶段 2：首页与快速记账

- 实现 `/m/calendar`。
- 实现 `QuickFlowSheet`。
- 复用现有日历数据、月收入支出、预算数据、语音记账、流水新增逻辑。

验收：

- 首页可查看月统计、日历、今日流水。
- 可打开快速记账并保存流水。
- 语音记账入口可继续触发现有流程。

### 阶段 3：流水与分析

- 实现 `/m/flows`。
- 实现 `/m/analysis`。
- 复用现有流水分页、筛选、导入导出、图表 API。

验收：

- 流水按日期分组展示。
- 筛选、搜索、编辑、删除可用。
- 分析页图表在 390px 宽度下不横向溢出。

### 阶段 4：预算、待收款、账本

- 实现 `/m/budget`。
- 实现 `/m/receivable`。
- 实现 `/m/books`。

验收：

- 预算和固定支出可管理。
- 待收款可按状态处理。
- 账本可新增、切换、分享、删除。

### 阶段 5：记账配置与我的

- 实现 `/m/config`。
- 实现 `/m/settings`。
- 将类型管理、默认项、CSV 映射入口整合为移动端配置中心。

验收：

- 类型名称可修改并保留风险提示。
- 默认记账项可保存。
- 我的页可进入所有低频能力。

## 风险与处理

- 风险：client middleware 读取 `localStorage` 可能造成首次加载短暂跳转。
  - 处理：只在客户端执行，页面骨架尽量轻；后续可同步写 cookie 支持 SSR 预判。
- 风险：新旧路由双向跳转可能形成循环。
  - 处理：路由映射函数必须判断 `target !== to.path`。
- 风险：新 UI 复用旧弹窗导致体验割裂。
  - 处理：第一阶段可复用逻辑，第二阶段逐步替换为移动端抽屉。
- 风险：导入导出、批量操作不适合首屏。
  - 处理：移动端放入更多菜单和选择模式。

## 验证策略

- 手动验证 390x844、375x812、430x932 三种移动视口。
- 验证新旧 UI 切换和刷新保持。
- 验证每个新 UI 页面没有横向滚动。
- 验证所有表单输入在移动键盘下仍可操作。
- 验证深色模式不破坏颜色语义。
