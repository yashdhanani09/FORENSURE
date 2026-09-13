@echo off
title FORENSURE — Quick Push
color 0A
cd /d "%~dp0"

echo.
echo  Staging all changes...
git add --all

echo.
set /p MSG="  Enter commit message (or press Enter for auto-message): "
if "%MSG%"=="" set MSG=update: %date% %time%

git commit -m "%MSG%"
git push

echo.
echo  ✅ Done! Pushed to github.com/yashdhanani09/FORENSURE
echo     Vercel will auto-redeploy in ~60 seconds.
echo.
pause
