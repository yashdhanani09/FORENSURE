@echo off
title FORENSURE - Launch as Administrator
color 0B
cd /d "%~dp0"

echo.
echo ============================================================
echo   FORENSURE  |  Administrator Launcher (UAC)
echo ============================================================
echo.

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [*] Requesting Windows Administrator privileges (UAC)...
    powershell -NoProfile -Command "Start-Process cmd -ArgumentList '/k cd /d \""%~dp0\"" && RUN-AS-ADMIN.bat' -Verb RunAs"
    if %errorLevel% neq 0 (
        echo.
        echo [!] UAC prompt was dismissed or blocked by Windows policy.
        echo [*] Manual Alternative:
        echo     Right-click 'RUN-AS-ADMIN.bat' and select 'Run as administrator'.
        echo.
        pause
    )
    exit /b
)

echo [+] Administrator privileges verified.
echo [*] Freeing port 8000 if occupied by non-elevated bridge...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | Where-Object { $_ -gt 4 } | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }" >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo [*] Starting FORENSURE in elevated mode...
echo.

if exist "backend\.wvenv\Scripts\activate.bat" (
    cd backend
    call .wvenv\Scripts\activate.bat
    python agent_entry.py
) else if exist "START.bat" (
    call START.bat
) else if exist "START-BRIDGE.bat" (
    call START-BRIDGE.bat
) else if exist "FORENSURE-Bridge.exe" (
    FORENSURE-Bridge.exe
) else (
    echo [!] Could not locate startup script or Python environment.
    pause
)

echo.
echo ============================================================
echo [!] Process stopped.
echo ============================================================
pause
