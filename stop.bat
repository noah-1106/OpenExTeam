@echo off
chcp 65001 >nul 2>&1
title OpenExTeam - 停止

:: 通过端口查找并停止 node 进程
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :4000 ^| findstr LISTENING') do (
  taskkill /pid %%a /f >nul 2>&1
  echo OpenExTeam 已停止（PID: %%a）
  goto :done
)

echo OpenExTeam 未在运行

:done
echo.
pause
