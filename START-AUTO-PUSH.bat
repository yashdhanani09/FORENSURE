@echo off
title FORENSURE — Auto GitHub Sync
color 0B
echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║   FORENSURE — Auto GitHub Sync Watcher       ║
echo  ║   Starting... Press Ctrl+C anytime to stop   ║
echo  ╚══════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

powershell -ExecutionPolicy Bypass -File "%~dp0watch-and-push.ps1"

pause
