#!/bin/bash
# OpenExTeam 停止脚本 (macOS)
# 双击此文件即可停止服务器

# 通过 PID 文件停止
if [ -f ~/.openexteam/server.pid ]; then
  PID=$(cat ~/.openexteam/server.pid)
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID"
    rm -f ~/.openexteam/server.pid
    echo "OpenExTeam 已停止（PID: $PID）"
  else
    rm -f ~/.openexteam/server.pid
    echo "服务器进程已不存在"
  fi
else
  # 回退：通过端口查找
  PID=$(lsof -ti :4000 2>/dev/null | head -1)
  if [ -n "$PID" ]; then
    kill "$PID"
    echo "OpenExTeam 已停止（PID: $PID）"
  else
    echo "OpenExTeam 未在运行"
  fi
fi

read -p "按 Enter 键关闭此窗口..."
