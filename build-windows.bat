@echo off
setlocal
cd /d %~dp0
where node >nul 2>nul || (echo Node.js is required: https://nodejs.org/ & exit /b 1)
call npm install || exit /b 1
call npm run test || exit /b 1
call npm run build:win || exit /b 1
echo.
echo Windows installer and portable app created in the release folder.
endlocal
