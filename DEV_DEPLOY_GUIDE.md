# Cashbook 项目开发与部署指南

基于 Nuxt 4 + Vue 3 + TailwindCSS + Prisma 的全栈记账本应用。

## 1. 架构简述 (Architectural Brief)
- **前端/服务端渲染**：使用 Nuxt 框架（基于 Vue 3 组合式 API + Pinia 状态管理 + TailwindCSS 样式）。
- **数据与持久化**：使用 Prisma ORM 访问后端数据库（官方推荐 PostgreSQL，但也支持 MySQL/SQLServer/SQLite）。
- **容器化支持**：项目已原生提供 `Dockerfile` 及完整的 `docker-compose.yaml`，非常适合直接做生产环境的容器化部署。

---

## 2. 本地开发指南

由于项目包含数据库操作，本地启动前需要先准备好数据库环境。以下以使用 Docker 快速启动本地 PostgreSQL 为例：

### 第 1 步：快速启动本地 PostgreSQL 容器

在本地终端执行以下命令，快速拉起一个包含初始数据的 Postgres 实例后台运行：

```bash
docker run -d \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=cashbook \
  -p 5432:5432 \
  --name local_cashbook_db \
  postgres:17.4-alpine3.21
```
*备注：此命令将暴露 `5432` 端口到本地，数据库默认账户名是 `postgres`，初始密码设置为 `postgres`，默认数据库名为 `cashbook`。*

### 第 2 步：项目环境与依赖配置

```bash
# 1. 准备本地开发环境依赖 (使用 yarn)
yarn install

# 2. 配置与数据库的连接
# 在项目根目录（或 server 目录，请根据运行报错灵活调整）创建一个 `.env` 文件。
# 由于我们使用上一步的 Docker 本地端口映射，请将 `.env` 写入以下内容：
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/cashbook?schema=public"

# 3. Prisma 数据库结构同步
# 确保 Prisma Client 基于当前最新的 schema 生成了对应的 TypeScript 类型
yarn prisma generate

# 首次初始化或表结构有变动时，执行 migrate 以同步数据库结构表到刚刚启动的 local_cashbook_db 中
yarn prisma migrate dev
```

### 第 3 步：启动本地开发服务器

一切准备就绪后，启动前端项目：

```bash
yarn dev
```
启动后即可在浏览器访问 `http://localhost:3000` 进入对应的本地调试模式。

---

## 3. 服务器部署指南

该项目强烈建议使用 **Docker Compose** 进行服务器部署。项目自带的配置在 `docker/docker-compose.yaml` 中，它已经配置好了主应用与 PostgreSQL 数据库的双容器编排。

### 服务器端操作步骤：

```bash
# 1. 将项目中的 docker 文件夹上传/复制到目标服务器
scp -r ./docker user@your-server-ip:/path/to/deploy/cashbook

# 2. 进入服务器部署目录
cd /path/to/deploy/cashbook

# 3. 按照需求修改 docker-compose.yaml（非常关键！）
# - 修改 main 容器的 NUXT_AUTH_SECRET（务必更改加密密钥）
# - 修改 main 容器的 NUXT_ADMIN_PASSWORD（后台登录密码，需使用项目的密码明文加密生成）
# - 修改 db 容器的 POSTGRES_PASSWORD（数据库密码）
# - 同步修改 main 容器的 DATABASE_URL 中的密码部分以匹配 db 容器配置

# 面向命令行的编辑推荐：
vim docker-compose.yaml

# 4. 拉取镜像并后台启动
docker-compose up -d

# 5. 查看系统运行日志确认启动成功
docker-compose logs -f main
```

---

## 4. 关键注意事项 (Critical "Watch-outs")
- **安全与密码**：在部署到公网服务器时，必须修改 `docker-compose.yaml` 中的环境变量（如 `NUXT_AUTH_SECRET`, `NUXT_ADMIN_PASSWORD` 和 `POSTGRES_PASSWORD`）。尤其是管理员密码需要前往 `你的url/admin/GetPassword` 生成加密字符串后再填入配置。
- **数据持久化**：部署时系统会自动将数据挂载到本地的 `./data`（应用数据目录）与 `./db`（数据库存储目录），在做服务器迁移或备份时，只需备份这两个目录即可。
- **包管理器**：项目中存在 `package-lock.json`（NPM 产物），由于强制使用 `yarn`，在首次执行 `yarn install` 后会生成 `yarn.lock`。建议提交时将 `package-lock.json` 移除并在 `.gitignore` 忽略以免混淆。
- **项目维护状态**：原作者声明当前该仓库已转入“仅维护”状态，仅处理 BUG 而不再新增功能，如果有深度二次开发需求，需自行长期维护 Fork 分支。
