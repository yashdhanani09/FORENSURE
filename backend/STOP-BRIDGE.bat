@echo off
title FORENSURE - Stop Hardware Bridge
color 0B
cd /d "%~dp0"

echo.
echo ============================================================
echo   FORENSURE  |  Stop Hardware Bridge
echo ============================================================
echo.

echo [*] Stopping background process on port 8000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)
taskkill /F /IM FORENSURE-Bridge.exe >nul 2>&1

echo [+] FORENSURE Bridge has been stopped.
echo.
pause
