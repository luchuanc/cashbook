# 移动端新版 UI 需求上下文

## 需求级别

Standard。

本需求当前阶段只输出规划、UI 图和实施文档，不进入代码实现。后续若开始实现，需要按本目录 `plan.md` 的分阶段方案执行。

## 当前代码事实

- 项目为 Nuxt 4 + Vue 3 + Tailwind 的单仓库应用。
- 前台主布局为 `app/layouts/public.vue`。
- 当前前台已存在移动端适配，但整体仍保留较多桌面表格、工具栏、抽屉和弹窗模式。
- 当前前台主页面包括：
  - `/login`：登录、注册、主题切换、后台入口。
  - `/calendar`：账本日历、月收入/支出/结余、流水弹窗、语音记账入口。
  - `/flows`：流水统计、搜索、导入导出、批量操作、流水表格、编辑弹窗。
  - `/analysis`：月度分析、消费/收入维度图表、AI 流水分析。
  - `/budget`：预算概览、固定支出管理。
  - `/receivable`：待收款列表、状态管理、收款操作。
  - `/books`：账本管理、共享账本、切换/编辑/删除。
  - `/types`：类型管理、历史数据映射、CSV 导入映射配置。
  - `/default-types`：默认流水类型、默认归属、默认支付方式。
- 当前底部导航位于 `app/components/layout/AppBottomNav.vue`，包含预算、分析、日历、流水、账本。
- 当前侧边栏位于 `app/components/layout/AppSidebar.vue`，包含日历、分析、流水、待收款、预算、账本、类型、默认类型等完整入口。
- 流水新增/编辑核心组件为 `app/components/dialog/FlowEditDialog.vue`，已支持默认记账项、类型联动、名称/归属/支付方式候选项。

## 设计目标

- 只面向移动端重新设计一套 UI。
- 新 UI 不影响旧页面，不要求替换旧页面。
- 旧 UI 和新 UI 需要双向可切换。
- 用户切换后的 UI 类型需要记录到本地缓存，每次进入应用时默认使用上次选择。
- 新 UI 应符合中国用户记账习惯：中文信息密度适中、金额与日期突出、收入/支出颜色稳定、常用配置入口清晰。

## 设计资产

独立页面 UI 图位于：

- `ui/01-login.png`
- `ui/02-home-calendar.png`
- `ui/03-quick-flow.png`
- `ui/04-flows.png`
- `ui/05-analysis.png`
- `ui/06-budget.png`
- `ui/07-receivable.png`
- `ui/08-books.png`
- `ui/09-types-defaults.png`
- `ui/10-me-settings.png`

