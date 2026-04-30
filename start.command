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

# 检查是否已在运行
if curl -s http://localhost:4000/health > /dev/null 2>&1; then
  echo "OpenExTeam 已在运行，打开浏览器..."
  open http://localhost:4000
  read -p "按 Enter 键关闭此窗口..."
  exit 0
fi

# 清理残留 PID（进程已退出但 pid 文件还在）
if [ -f ~/.openexteam/server.pid ]; then
  OLD_PID=$(cat ~/.openexteam/server.pid)
  if ! kill -0 "$OLD_PID" 2>/dev/null; then
    rm -f ~/.openexteam/server.pid
  fi
fi

# 后台启动服务器（nohup 脱离终端，关闭窗口不影响运行）
nohup node server/index.js > ~/.openexteam/server.log 2>&1 &
SERVER_PID=$!
echo $SERVER_PID > ~/.openexteam/server.pid

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
echo "服务器已在后台运行（PID: $SERVER_PID）"
echo "关闭此窗口不影响服务器运行"
echo "日志文件: ~/.openexteam/server.log"
echo ""
echo "如需停止服务器，运行："
echo "  kill $SERVER_PID"
echo ""
read -p "按 Enter 键关闭此窗口..."
