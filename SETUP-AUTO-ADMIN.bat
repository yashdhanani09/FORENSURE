@echo off
title FORENSURE - Enable Permanent Silent Administrator Mode
color 0B
cd /d "%~dp0"

echo.
echo ============================================================
echo   FORENSURE  |  Permanent Auto-Admin Setup
echo ============================================================
echo.

:: 1. Check for uninstall argument
if "%1"=="/uninstall" goto :UNINSTALL
if "%1"=="/remove" goto :UNINSTALL

:: 2. Check administrator privilege (elevate if needed)
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [*] Requesting Administrator privileges to register Windows Task...
    powershell -NoProfile -Command "Start-Process cmd -ArgumentList '/k cd /d \""%~dp0\"" && SETUP-AUTO-ADMIN.bat' -Verb RunAs"
    if %errorLevel% neq 0 (
        echo [!] UAC elevation request was canceled or failed.
        echo [*] Manual Alternative: Right-click SETUP-AUTO-ADMIN.bat and choose 'Run as administrator'.
        pause
    )
    exit /b
)

:: 3. Locate run_silent.ps1
set RUN_PS1=%~dp0run_silent.ps1
if not exist "%RUN_PS1%" (
    set RUN_PS1=%~dp0backend\run_silent.ps1
)

if not exist "%RUN_PS1%" (
    echo [ERROR] Could not locate run_silent.ps1 in %~dp0
    pause
    exit /b 1
)

echo [*] Registering elevated Windows Task 'FORENSURE_Bridge'...
schtasks /create /tn "FORENSURE_Bridge" /tr "powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File \"%RUN_PS1%\"" /rl HIGHEST /sc ONLOGON /f >nul 2>&1

if %errorLevel% equ 0 (
    echo [+] SUCCESS! Task 'FORENSURE_Bridge' registered with Highest Privileges.
    echo.
    echo [*] Starting FORENSURE Bridge in silent elevated mode now...
    schtasks /run /tn "FORENSURE_Bridge" >nul 2>&1
    echo [+] Bridge process started silently in background on http://127.0.0.1:8000.
    echo.
    echo ============================================================
    echo   WHAT HAPPENS NEXT:
    echo   1. The bridge will now launch automatically on Windows login.
    echo   2. You will NEVER see another UAC prompt for raw disk access.
    echo   3. No terminal window will flash or remain open on your screen.
    echo   4. To uninstall anytime, run: SETUP-AUTO-ADMIN.bat /uninstall
    echo ============================================================
    echo.
) else (
    echo [!] Failed to register Windows Task. Error code: %errorLevel%
    echo     Please make sure you right-clicked and selected 'Run as administrator'.
    echo.
)

pause
exit /b 0

:UNINSTALL
net session >nul 2>&1
if %errorLevel% neq 0 (
    powershell -NoProfile -Command "Start-Process cmd -ArgumentList '/k cd /d \""%~dp0\"" && SETUP-AUTO-ADMIN.bat /uninstall' -Verb RunAs"
    exit /b
)
echo [*] Removing 'FORENSURE_Bridge' scheduled task...
schtasks /delete /tn "FORENSURE_Bridge" /f >nul 2>&1
echo [+] Auto-admin task removed successfully.
pause
exit /b 0
