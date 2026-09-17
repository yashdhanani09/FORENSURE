@echo off
title FORENSURE - Launch as Administrator
color 0B
cd /d "%~dp0"

echo.
echo ============================================================
echo   FORENSURE  ^|  Administrator Launcher (UAC)
echo ============================================================
echo.

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [*] Requesting Windows Administrator privileges (UAC)...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo [+] Administrator privileges verified.
echo [*] Starting FORENSURE services in elevated mode...
echo.

if exist "START.bat" (
    call START.bat
) else if exist "START-BRIDGE.bat" (
    call START-BRIDGE.bat
) else if exist "backend\.wvenv\Scripts\activate.bat" (
    cd backend
    call .wvenv\Scripts\activate.bat
    python agent_entry.py
) else (
    echo [!] Could not locate startup script.
    pause
)
