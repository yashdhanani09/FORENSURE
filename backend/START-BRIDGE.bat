@echo off
title FORENSURE Hardware Bridge
color 0B
cd /d "%~dp0"

:: Self-elevate to Administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo  [*] Requesting Administrator privileges (UAC)...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo.
echo  ================================================================
echo    FORENSURE  ^|  VERIFY. SANITIZE. RECOVER.
echo    Hardware Bridge Launcher
echo  ================================================================
echo.

if not exist "FORENSURE-Bridge.exe" (
    echo  [ERROR] FORENSURE-Bridge.exe not found.
    echo  Make sure you extracted ALL files from the zip first.
    echo.
    pause
    exit /b 1
)

echo  [+] Starting FORENSURE-Bridge on http://127.0.0.1:8000
echo.

FORENSURE-Bridge.exe

echo.
echo  ================================================================
echo  [!] Bridge has stopped. See messages above for any errors.
echo  ================================================================
echo.
pause
