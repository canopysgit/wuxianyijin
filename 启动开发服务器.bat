@echo off
title 五险一金尽职调查系统 - 开发服务器
echo ========================================
echo   五险一金尽职调查系统
echo   开发服务器启动中...
echo ========================================
echo.

REM 进入项目目录
cd /d "C:\96AICoding\foshan"

REM 检查node_modules是否存在，如果不存在则安装依赖
if not exist "node_modules" (
    echo 正在安装项目依赖...
    npm install
    echo.
)

REM 启动开发服务器
echo 启动Next.js开发服务器...
echo 服务器启动后请访问: http://localhost:3000
echo.
echo 按 Ctrl+C 可停止服务器
echo ========================================
npm run dev

REM 如果服务器意外退出，暂停以查看错误信息
pause