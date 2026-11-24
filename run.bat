@echo off
title Sultan Sports Kadapa - 3D Walk-In Showroom
cd /d "%~dp0"

echo ========================================================
echo    SULTAN SPORTS KADAPA - 3D WALK-IN SHOWROOM
echo    Near Apsara Theatre, Chinna Chauku, Kadapa
echo ========================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org/ and try again.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo Installing required packages for the first time...
    call npm install
)

echo Starting the 3D Showroom local server and opening your browser...
echo (Press Ctrl + C in this window anytime to stop the server.)
echo.

start "" http://localhost:5173/
call npm run dev -- --port 5173
pause
