@echo off
title FORENSURE Hardware Bridge — Starting...
color 0B
cd /d "%~dp0"

echo.
echo  ================================================================
echo    FORENSURE  ^|  VERIFY. SANITIZE. RECOVER.
echo    Hardware Bridge Launcher
echo  ================================================================
echo.

:: Check if the exe exists next to this bat file
if not exist "FORENSURE-Bridge.exe" (
    echo  [ERROR] FORENSURE-Bridge.exe not found in this folder.
    echo  Make sure you extracted ALL files from the zip before running.
    echo.
    pause
    exit /b 1
)

:: Check for admin rights — if not admin, re-launch with UAC
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo  [*] Requesting Administrator privileges...
    echo  [*] Click YES on the Windows UAC popup that appears.
    echo.
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo  [+] Running with Administrator privileges — OK
echo  [+] Starting FORENSURE-Bridge on http://127.0.0.1:8000
echo.

:: Run the exe — window stays open because we pause after it exits
FORENSURE-Bridge.exe

echo.
echo  ================================================================
echo  [!] Bridge has stopped. Check messages above for any errors.
echo  ================================================================
echo.
pause
