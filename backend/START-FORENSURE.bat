@echo off
title FORENSURE - One-Click Setup & Launch
color 0B
cd /d "%~dp0"

echo.
echo ================================================================
echo   FORENSURE  ^|  VERIFY. SANITIZE. RECOVER.
echo   One-Click Setup + Launch
echo ================================================================
echo.

:: ── Step 0: Auto-elevate if not already admin ─────────────────────────────
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [*] Requesting Administrator privileges ^(UAC^)...
    powershell -NoProfile -Command "Start-Process cmd -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

echo [+] Running as Administrator.
echo.

:: ── Step 1: Add Windows Defender exclusion for this folder ────────────────
echo [1/4] Adding Windows Defender exclusion for FORENSURE-Bridge...
set "BRIDGE_DIR=%~dp0"
if "%BRIDGE_DIR:~-1%"=="\" set "BRIDGE_DIR=%BRIDGE_DIR:~0,-1%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "Add-MpPreference -ExclusionPath '%BRIDGE_DIR%' -ErrorAction SilentlyContinue" >nul 2>&1

if %errorLevel% equ 0 (
    echo [+] Defender exclusion added — antivirus will no longer block the bridge.
) else (
    echo [!] Could not add Defender exclusion automatically ^(may already exist^).
    echo     If you see virus alerts, see the Troubleshooting section in the web app.
)
echo.

:: ── Step 2: Kill any existing bridge on port 8000 ────────────────────────
echo [2/4] Stopping any existing FORENSURE Bridge process on port 8000...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | Where-Object { $_ -gt 4 } | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }" >nul 2>&1
taskkill /F /IM FORENSURE-Bridge.exe >nul 2>&1
timeout /t 1 /nobreak >nul
echo [+] Port 8000 is clear.
echo.

:: ── Step 3: Register silent auto-admin Windows Task ──────────────────────
echo [3/4] Registering permanent auto-start scheduled task...

set "RUN_PS1=%~dp0run_silent.ps1"
if not exist "%RUN_PS1%" set "RUN_PS1=%~dp0backend\run_silent.ps1"

if exist "%RUN_PS1%" (
    schtasks /create /tn "FORENSURE_Bridge" /tr "powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File \"%RUN_PS1%\"" /rl HIGHEST /sc ONLOGON /f >nul 2>&1
    if %errorLevel% equ 0 (
        echo [+] Auto-start task registered — bridge will launch on every Windows login.
    ) else (
        echo [~] Task already registered or could not update ^(non-critical^).
    )
) else (
    echo [~] run_silent.ps1 not found — skipping auto-start task ^(non-critical^).
)
echo.

:: ── Step 4: Launch FORENSURE Bridge ──────────────────────────────────────
echo [4/4] Starting FORENSURE Hardware Bridge...
echo.

if exist "FORENSURE-Bridge.exe" (
    start "" "FORENSURE-Bridge.exe"
) else if exist "START-BRIDGE.bat" (
    start "" "cmd" /c "START-BRIDGE.bat"
) else if exist ".wvenv\Scripts\activate.bat" (
    start "" "cmd" /k "call .wvenv\Scripts\activate.bat && python agent_entry.py"
) else if exist "..\backend\.wvenv\Scripts\activate.bat" (
    start "" "cmd" /k "cd ..\backend && call .wvenv\Scripts\activate.bat && python agent_entry.py"
) else (
    echo [!] Could not locate FORENSURE-Bridge.exe or Python environment.
    echo     Make sure you extracted FORENSURE-Bridge-Windows.zip into this folder.
    pause
    exit /b 1
)

:: ── Wait a moment for bridge to bind port 8000 ────────────────────────────
echo [*] Waiting for bridge to start...
timeout /t 3 /nobreak >nul

:: ── Open the web app in the default browser ───────────────────────────────
echo [*] Opening FORENSURE web app in your browser...
start "" "https://forensure.vercel.app"

echo.
echo ================================================================
echo   [ALL DONE] FORENSURE is running!
echo.
echo   Bridge API  : http://127.0.0.1:8000
echo   Web App     : https://forensure.vercel.app
echo   Mode        : Administrator (full raw disk access)
echo.
echo   To stop the bridge, close the FORENSURE-Bridge window
echo   or run STOP-BRIDGE.bat
echo ================================================================
echo.
timeout /t 5 /nobreak >nul
exit /b 0
