#!/bin/bash

# ==============================================================================
# 陆家账本 一键部署脚本 
# 该脚本将从 Git 远端拉取最新代码，使用本地 Dockerfile 重新构建镜像并重启容器。
# ==============================================================================

COMPOSE_FILE="docker-compose.build.yml"

echo "==== 1. 拉取最新代码 ===="
git pull origin main || { echo "❌ 拉取代码失败"; exit 1; }

echo "==== 1.5. 检查超算平台 API Key ===="
if ! grep -q "NUXT_SUPERCOMPUTING_API_KEY=" .env || grep -q 'NUXT_SUPERCOMPUTING_API_KEY=""' .env; then
  echo "⚠️  检测到 NUXT_SUPERCOMPUTING_API_KEY 未配置或为空"
  read -p "请输入你的超算平台 API Key (https://www.scnet.cn/ui/llm/apikeys): " API_KEY
  if [ -z "$API_KEY" ]; then
    echo "❌ API Key 为空，部署取消"
    exit 1
  fi
  # 更新 .env 文件中的 API Key
  if grep -q 'NUXT_SUPERCOMPUTING_API_KEY=' .env; then
    sed -i.bak "s|NUXT_SUPERCOMPUTING_API_KEY=.*|NUXT_SUPERCOMPUTING_API_KEY=\"$API_KEY\"|" .env
  else
    echo "NUXT_SUPERCOMPUTING_API_KEY=\"$API_KEY\"" >> .env
  fi
  echo "✅ API Key 已保存到 .env 文件"
else
  echo "✅ 超算平台 API Key 已配置"
fi

echo "==== 2. 停止并移除旧容器 ===="
# 先尝试正常 down，加 --remove-orphans 清理残留
docker-compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null

# 兜底：如果还有残留容器，强制停止并移除
for container in cashbook4_local cashbook_db_local; do
  if docker ps -aq -f name="^${container}$" | grep -q .; then
    echo "强制清理残留容器: $container"
    docker stop "$container" 2>/dev/null
    docker rm -f "$container" 2>/dev/null
  fi
done

# 兜底：清理可能残留的网络
docker network ls --format '{{.Name}}' | grep cashbook | while read net; do
  docker network rm "$net" 2>/dev/null && echo "已清理网络: $net"
done

echo "==== 3. 重新构建镜像并启动容器 ===="
docker-compose -f "$COMPOSE_FILE" up -d --build || { echo "❌ 构建启动失败"; exit 1; }

echo "==== 4. 清理无用（悬空）的镜像以释放空间 ===="
docker image prune -f

echo "✅ 部署完成！查看日志："
echo "docker-compose -f $COMPOSE_FILE logs -f main"
