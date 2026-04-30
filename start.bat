@echo off
chcp 65001 >nul 2>&1
title OpenExTeam

cd /d "%~dp0"

:: 检查 Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
  echo ============================================
  echo   未检测到 Node.js，请先安装：
  echo   https://nodejs.org/zh-cn
  echo ============================================
  echo.
  pause
  exit /b 1
)

:: 检查依赖
if not exist "node_modules" (
  echo 正在安装依赖...
  call npm install --production
  cd client && call npm install --production && cd ..
  cd server && call npm install --production && cd ..
)

:: 检查前端是否已构建
if not exist "client\dist" (
  echo 正在构建前端...
  cd client && call npm install && call npx vite build && cd ..
)

echo.
echo ============================================
echo   OpenExTeam 启动中...
echo ============================================
echo.

:: 启动服务器
start /b node server/index.js

:: 等待服务器就绪后打开浏览器
timeout /t 3 /nobreak >nul
start http://localhost:4000

echo.
echo 关闭此窗口将停止服务器
echo 按 Ctrl+C 停止服务器
echo.

:: 保持窗口
cmd /k
