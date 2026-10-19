@echo off
setlocal
title RegLens
rem Double-click to run RegLens. First run installs everything and seeds demo data.
cd /d "%~dp0"

where node >nul 2>&1 || (
  echo [RegLens] Node.js 20+ is required: https://nodejs.org/
  pause & exit /b 1
)
where py >nul 2>&1 || where python >nul 2>&1 || (
  echo [RegLens] Python 3.11+ is required: https://www.python.org/downloads/
  pause & exit /b 1
)

if not exist "backend\.venv" goto setup
if not exist "node_modules" goto setup
if not exist "frontend\node_modules" goto setup
goto seed

:setup
echo [RegLens] First run: installing dependencies. This can take a few minutes...
call npm run setup
if errorlevel 1 (
  echo [RegLens] Setup failed. If you see EPERM/EBUSY errors, pause OneDrive sync and try again.
  pause & exit /b 1
)

:seed
if exist "backend\data\reglens.db" goto run
echo [RegLens] Seeding demo data...
call npm run seed
if errorlevel 1 (
  echo [RegLens] Seeding failed.
  pause & exit /b 1
)

:run
if /i "%~1"=="--reseed" (
  echo [RegLens] Re-seeding fresh demo data...
  call npm run seed
)
echo.
echo [RegLens] Starting API (http://localhost:8000) and web app (http://localhost:5173)
echo [RegLens] The browser opens automatically. Close this window or press Ctrl+C to stop.
echo.
start "" /b cmd /c "timeout /t 15 /nobreak >nul & start http://localhost:5173"
call npm run dev
pause
