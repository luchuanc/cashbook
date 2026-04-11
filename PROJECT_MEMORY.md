# Cashbook 项目记忆文档

更新时间：2026-04-11

## 1. 项目定位
- 项目名：`cashbook`
- 形态：Nuxt 全栈记账系统（前台 + 管理后台）
- 当前状态（来自 README）：主仓库以 BUG 维护为主，不再新增功能

## 2. 技术栈与关键依赖
- 前端/服务端框架：`Nuxt 4.4.2`（`Vue 3.5.x`）
- 样式：`TailwindCSS`
- 状态管理：`Pinia`
- 图表：`echarts` + `nuxt-echarts`
- 数据库访问：`Prisma 7.6.0` + `@prisma/adapter-pg`
- 鉴权：`jsonwebtoken`（普通用户 JWT）
- API 文档：`nuxt-openapi-docs-module` + `swagger-jsdoc`

## 3. 运行与构建方式
- 开发：`npm run dev`（端口 `9090`，配置在 `nuxt.config.ts`）
- 构建：`npm run build`
- 预览：`npm run preview`
- 注意：仓库同时存在 `package-lock.json` 与 `yarn.lock`，历史文档里有 yarn 用法，但当前 `package.json` 脚本可直接用 npm。

## 4. 核心目录职责
- `app/`：前端页面、组件、布局、中间件
  - `app/pages/`：业务页面（流水、预算、分析、应收、后台管理等）
  - `app/components/`：UI 与业务组件（含 charts/flows/dialog）
  - `app/middleware/`：前端路由守卫（用户态/管理员态）
- `server/`：后端 API 与服务逻辑
  - `server/api/entry/*`：用户业务 API（账本/流水/预算/应收/分析等）
  - `server/api/admin/*`：后台管理 API
  - `server/middleware/auth.ts`：API 鉴权入口
  - `server/lib/prisma.ts`：Prisma 客户端初始化
- `prisma/`：数据模型、迁移、生成代码
- `docker/`：镜像版部署配置（官方镜像 `dingdangdog/cashbook`）
- `docker-compose.build.yml`：本地源码构建部署编排
- `deploy.sh`：服务器一键部署脚本（见第 8 节）

## 5. 数据库模型（PostgreSQL）
`prisma/schema.prisma` 当前 provider 固定为 `postgresql`，核心表：
- `SystemSetting`：系统设置
- `User`：用户
- `Book`：账本
- `Flow`：流水
- `Budget`：预算
- `Receivable`：应收
- `FixedFlow`：固定流水
- `TypeRelation`：导入类型映射

## 6. 鉴权与安全机制
- 普通用户接口：
  - 路径前缀 `/api/entry`
  - 依赖请求头 `Authorization`（JWT）
  - 校验逻辑在 `server/middleware/auth.ts`
- 管理员接口：
  - 路径前缀 `/api/admin/entry`
  - 依赖请求头 `Admin`
  - Token 由账号和加密密码派生（非 JWT）
- 关键环境变量：
  - `DATABASE_URL`
  - `NUXT_AUTH_SECRET`
  - `NUXT_ADMIN_USERNAME`
  - `NUXT_ADMIN_PASSWORD`
  - `NUXT_DATA_PATH`
  - `NUXT_SUPERCOMPUTING_API_KEY`

## 7. API 与文档
- 已启用 Nitro OpenAPI 实验配置
- 文档相关文件：
  - `swagger.config.ts`
  - `server/api/openapi.json.ts`
  - `public/openapi.json`
- 前端文档页：`app/pages/api-docs.vue`

## 8. 部署记忆（重点）
- `deploy.sh` 是**服务器上的一键部署脚本**，执行逻辑：
1. `git pull origin main`
2. 检查并补全 `.env` 中 `NUXT_SUPERCOMPUTING_API_KEY`
3. `docker-compose -f docker-compose.build.yml down --remove-orphans`
4. 强制清理残留容器与网络
5. `docker-compose -f docker-compose.build.yml up -d --build`
6. `docker image prune -f`
- 结论：这是“拉最新代码 + 本地构建镜像 + 重启容器”的服务器运维脚本，不是仅本地开发脚本。

## 9. 容器与运行时细节
- `Dockerfile` 为多阶段构建：
  - builder：安装依赖并 `npm run build`
  - runner：复制 `.output`，启动前执行 `entrypoint.sh`
- `docker/entrypoint.sh` 会在启动时循环执行 `npx prisma migrate deploy`，数据库就绪后再启动服务。

## 10. 后续维护建议（给接手者）
- 优先确认 `.env` 与部署环境变量是否已替换默认值（尤其管理员密码和密钥）。
- 在变更数据库结构时，保持 `prisma/migrations` 与生产迁移流程一致。
- 若继续演进包管理器，建议统一到 npm 或 yarn，避免双锁文件长期并存。
