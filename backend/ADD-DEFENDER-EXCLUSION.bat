@echo off
title FORENSURE - Add Windows Defender Exclusion
color 0E
cd /d "%~dp0"

echo.
echo ============================================================
echo   FORENSURE  ^|  Windows Defender Exclusion Setup
echo ============================================================
echo.
echo  This script will whitelist the FORENSURE-Bridge folder
echo  so Windows Defender does NOT block the bridge EXE.
echo.
echo  Forensic tools read raw disk sectors — this is normal
echo  behaviour that AV heuristics sometimes flag. The bridge
echo  is 100%% safe and open-source.
echo.

:: ── Check for Administrator rights ───────────────────────────────────────────
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] Administrator rights required.
    echo [*] Re-launching with UAC elevation...
    powershell -NoProfile -Command "Start-Process cmd -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

echo [*] Running as Administrator. Adding exclusion...
echo.

:: ── Get the current folder path ───────────────────────────────────────────────
set "BRIDGE_DIR=%~dp0"
:: Remove trailing backslash
if "%BRIDGE_DIR:~-1%"=="\" set "BRIDGE_DIR=%BRIDGE_DIR:~0,-1%"

echo [*] Exclusion path: %BRIDGE_DIR%
echo.

:: ── Add Windows Defender exclusion via PowerShell ─────────────────────────────
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "Add-MpPreference -ExclusionPath '%BRIDGE_DIR%' -ErrorAction Stop; Write-Host '[OK] Exclusion added successfully.'" 2>nul

if %errorLevel% equ 0 (
    echo.
    echo ============================================================
    echo   [SUCCESS] Exclusion added!
    echo.
    echo   Windows Defender will NO LONGER block FORENSURE-Bridge.
    echo   You can now run SETUP-AUTO-ADMIN.bat or RUN-AS-ADMIN.bat
    echo ============================================================
) else (
    echo.
    echo [!] Could not add exclusion automatically.
    echo.
    echo     Please add it manually:
    echo     1. Open Windows Security (Win+S, type "Windows Security")
    echo     2. Virus ^& threat protection
    echo     3. Manage settings ^> Exclusions ^> Add or remove exclusions
    echo     4. Add an exclusion ^> Folder
    echo     5. Browse to: %BRIDGE_DIR%
    echo     6. Click Select Folder
)

echo.
timeout /t 5 /nobreak >nul
exit /b
