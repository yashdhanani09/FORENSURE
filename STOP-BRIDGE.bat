@echo off
title FORENSURE - Stop Hardware Bridge
color 0B
cd /d "%~dp0"

echo.
echo ============================================================
echo   FORENSURE  |  Stop Hardware Bridge
echo ============================================================
net session >nul 2>&1
if %errorLevel% neq 0 (
    powershell -NoProfile -Command "Start-Process cmd -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

echo [*] Stopping background process on port 8000...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | Where-Object { $_ -gt 4 } | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }" >nul 2>&1
taskkill /F /IM FORENSURE-Bridge.exe >nul 2>&1

echo [+] FORENSURE Bridge has been stopped.
echo.
pause
