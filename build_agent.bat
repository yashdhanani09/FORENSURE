@echo off
title Build FORENSURE Hardware Bridge
color 0B

echo ============================================================
echo   Building FORENSURE-Bridge.exe with PyInstaller
echo ============================================================
echo.

cd /d "%~dp0backend"

if not exist ".wvenv\Scripts\activate.bat" (
    echo [ERROR] Virtual environment not found in backend\.wvenv
    echo Run SETUP.bat first!
    pause
    exit /b 1
)

call .wvenv\Scripts\activate.bat

echo [*] Compiling Python backend into standalone FORENSURE-Bridge binary...
pyinstaller --clean --noconfirm FORENSURE-Bridge.spec

if errorlevel 1 (
    echo [ERROR] Build failed!
    pause
    exit /b 1
)

echo.
echo [*] Copying helper scripts into dist\FORENSURE-Bridge...
copy /Y RUN-AS-ADMIN.bat dist\FORENSURE-Bridge\
copy /Y START-BRIDGE.bat dist\FORENSURE-Bridge\
copy /Y STOP-BRIDGE.bat dist\FORENSURE-Bridge\
copy /Y SETUP-AUTO-ADMIN.bat dist\FORENSURE-Bridge\

echo.
echo [*] Packaging into FORENSURE-Bridge-Windows.zip...
powershell -Command "Compress-Archive -Path 'dist\FORENSURE-Bridge\*' -DestinationPath '..\FORENSURE-Bridge-Windows.zip' -Force"
powershell -Command "Copy-Item '..\FORENSURE-Bridge-Windows.zip' 'FORENSURE-Bridge-Windows.zip' -Force"
powershell -Command "Copy-Item '..\FORENSURE-Bridge-Windows.zip' '..\frontend\public\FORENSURE-Bridge-Windows.zip' -Force"
if exist "..\frontend\dist" (
    powershell -Command "Copy-Item '..\FORENSURE-Bridge-Windows.zip' '..\frontend\dist\FORENSURE-Bridge-Windows.zip' -Force"
)

echo.
echo ============================================================
echo   BUILD SUCCESSFUL!
echo   Zip file ready at: FORENSURE-Bridge-Windows.zip
echo ============================================================
echo.

