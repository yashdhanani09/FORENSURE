@echo off
title Build SecureData Local Hardware Agent
color 0B

echo ============================================================
echo   Building SecureData-Agent.exe with PyInstaller
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

echo [*] Compiling Python backend into standalone binary...
pyinstaller --name "SecureData-Agent" --onedir --clean --noconfirm --collect-all app --hidden-import uvicorn --hidden-import uvicorn.logging --hidden-import uvicorn.loops --hidden-import uvicorn.loops.auto --hidden-import uvicorn.protocols --hidden-import uvicorn.protocols.http --hidden-import uvicorn.protocols.http.auto --hidden-import uvicorn.protocols.websockets --hidden-import uvicorn.protocols.websockets.auto --hidden-import reportlab --hidden-import PIL --hidden-import sqlalchemy.sql.default_comparator agent_entry.py

if errorlevel 1 (
    echo [ERROR] Build failed!
    pause
    exit /b 1
)

echo.
echo [*] Packaging into SecureData-Agent-Windows.zip...
powershell -Command "Compress-Archive -Path 'dist\SecureData-Agent\*' -DestinationPath '..\SecureData-Agent-Windows.zip' -Force"
powershell -Command "Copy-Item '..\SecureData-Agent-Windows.zip' '..\frontend\public\SecureData-Agent-Windows.zip' -Force"

echo.
echo ============================================================
echo   BUILD SUCCESSFUL!
echo   Zip file ready at: SecureData-Agent-Windows.zip
echo ============================================================
echo.
pause
