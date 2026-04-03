#!/bin/sh
echo "============================================="
echo "欢迎使用 Cashbook"
echo "============================================="
# 打印环境信息
# echo "Checking and creating database if it does not exist..."
# 等待数据库就绪
echo "Waiting for database to be ready..."
MAX_RETRIES=15
RETRY_COUNT=0
until echo "SELECT 1" | npx prisma db execute --stdin > /dev/null 2>&1; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "ERROR: Database not ready after ${MAX_RETRIES} retries, starting anyway..."
    break
  fi
  echo "Database not ready yet, retrying in 2s... ($RETRY_COUNT/$MAX_RETRIES)"
  sleep 2
done
echo "Database is ready!"

echo "Starting application with Prisma database initialization..."
npx prisma migrate deploy
echo "Success Run npx prisma migrate deploy."

# 启动应用程序
echo "Starting application..."
exec node server/index.mjs