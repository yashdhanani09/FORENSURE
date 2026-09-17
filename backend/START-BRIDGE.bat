@echo off
title FORENSURE Hardware Bridge
color 0B
cd /d "%~dp0"

echo.
echo  ================================================================
echo    FORENSURE  ^|  VERIFY. SANITIZE. RECOVER.
echo    Hardware Bridge Launcher
echo  ================================================================
echo.

net session >nul 2>&1
if %errorLevel% == 0 (
    echo  [+] Privilege Level : ADMINISTRATOR (FULL RAW DISK ACCESS)
) else (
    echo  [*] Privilege Level : STANDARD USER
    echo  [*] Note: You can grant Administrator access anytime
    echo      using the in-app "Run as Administrator (UAC)" button.
)

echo.
if not exist "FORENSURE-Bridge.exe" (
    if exist ".wvenv\Scripts\activate.bat" (
        echo  [*] Starting via local virtual environment...
        call .wvenv\Scripts\activate.bat
        python agent_entry.py
        goto :STOPPED
    )
    echo  [ERROR] FORENSURE-Bridge.exe not found in this folder.
    echo  Make sure you extracted ALL files from the zip first.
    echo.
    pause
    exit /b 1
)

echo  [+] Starting FORENSURE Bridge on http://127.0.0.1:8000 ...
echo.

FORENSURE-Bridge.exe
:STOPPED
echo.
echo  ================================================================
echo  [!] Bridge process has stopped.
echo  ================================================================
echo.
pause
