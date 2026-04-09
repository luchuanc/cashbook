#!/bin/sh
echo "============================================="
echo "欢迎使用 陆家账本"
echo "============================================="
# 打印环境信息
echo "Starting application with Prisma database initialization..."
export NODE_PATH=/usr/local/lib/node_modules

# 循环等待数据库就绪并执行 migrate (解决 db 还没启动好导致 migrate 失败的问题)
MAX_RETRIES=10
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  npx prisma migrate deploy && break
  RETRY_COUNT=$((RETRY_COUNT+1))
  echo "数据库未准备好或连接失败，等待 3 秒后重试... ($RETRY_COUNT/$MAX_RETRIES)"
  sleep 3
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "Prisma 迁移失败，退出进程。"
  exit 1
fi

echo "Success Run npx prisma migrate deploy."

# 启动应用程序
echo "Starting application..."
exec node server/index.mjs