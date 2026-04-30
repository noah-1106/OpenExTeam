#!/bin/bash
# OpenExTeam 一键启动脚本 (macOS)
# 双击此文件即可启动服务器并打开浏览器

cd "$(dirname "$0")"

# 检查 Node.js
if ! command -v node &> /dev/null; then
  echo "============================================"
  echo "  未检测到 Node.js，请先安装："
  echo "  https://nodejs.org/zh-cn"
  echo "============================================"
  echo ""
  read -p "按 Enter 键退出..."
  exit 1
fi

# 检查依赖
if [ ! -d "node_modules" ]; then
  echo "正在安装依赖..."
  npm install --production
  cd client && npm install --production && cd ..
  cd server && npm install --production && cd ..
fi

# 检查前端是否已构建
if [ ! -d "client/dist" ]; then
  echo "正在构建前端..."
  cd client && npm install && npx vite build && cd ..
fi

echo ""
echo "============================================"
echo "  OpenExTeam 启动中..."
echo "============================================"
echo ""

# 后台启动服务器，记录 PID
node server/index.js &
SERVER_PID=$!

# 等待服务器就绪
for i in $(seq 1 15); do
  if curl -s http://localhost:4000/health > /dev/null 2>&1; then
    echo "服务器已就绪！"
    open http://localhost:4000
    break
  fi
  sleep 1
done

echo ""
echo "按 Ctrl+C 停止服务器"
echo ""

# 等待服务器进程
wait $SERVER_PID
