#!/bin/bash

# ==============================================================================
# Cashbook 一键部署脚本 
# 该脚本将从 Git 远端拉取最新代码，使用本地 Dockerfile 重新构建镜像并重启容器。
# ==============================================================================

set -e # 遇到错误即刻停止运行

echo "==== 1. 拉取最新代码 ===="
git pull origin main

echo "==== 2. 停止并移除旧容器 ===="
# 如果容器存在则停止并移除（避免冲突）
docker-compose -f docker-compose.build.yml down

echo "==== 3. 重新构建镜像并启动容器 ===="
# `--build` 确保根据最新代码构建镜像，`-d` 后台运行
docker-compose -f docker-compose.build.yml up -d --build

echo "==== 4. 清理无用（悬空）的镜像以释放空间 ===="
docker image prune -f

echo "✅ 部署完成！您可以通过下面的命令查看日志："
echo "docker-compose -f docker-compose.build.yml logs -f main"
