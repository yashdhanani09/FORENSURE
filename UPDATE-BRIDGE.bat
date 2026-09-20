@echo off
title FORENSURE - Update Hardware Bridge
color 0A
cd /d "%~dp0"

echo.
echo ============================================================
echo   FORENSURE  ^|  Auto-Update & Restart Hardware Bridge
echo ============================================================
echo.

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [*] Elevating to Administrator permissions...
    powershell -NoProfile -Command "Start-Process cmd -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

echo [*] Stopping existing FORENSURE Bridge processes...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | Where-Object { $_ -gt 4 } | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }" >nul 2>&1
taskkill /F /IM FORENSURE-Bridge.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo [*] Extracting updated FORENSURE-Bridge-Windows.zip...
if exist "FORENSURE-Bridge-Windows.zip" (
    powershell -NoProfile -Command "Expand-Archive -Path 'FORENSURE-Bridge-Windows.zip' -DestinationPath '.' -Force"
) else if exist "..\FORENSURE-Bridge-Windows.zip" (
    powershell -NoProfile -Command "Expand-Archive -Path '..\FORENSURE-Bridge-Windows.zip' -DestinationPath '.' -Force"
) else (
    echo [!] Zip file not found in current or parent folder.
)

echo [*] Starting updated elevated bridge...
start "" "FORENSURE-Bridge.exe"
timeout /t 2 /nobreak >nul

echo.
echo ============================================================
echo   [SUCCESS] FORENSURE Hardware Bridge is updated and running!
echo   Port: 8000  ^|  Kernel Administrator Mode Active
echo ============================================================
echo.
timeout /t 3 /nobreak >nul
exit /b
