@echo off
REM Tally System - Start All Services
REM Batch script to start backend, web dashboard, and mobile app

echo ========================================
echo   Tally System 2.0 - Starting Services
echo ========================================
echo.

echo Select services to start:
echo 1. Backend only
echo 2. Web Dashboard only
echo 3. Backend + Web Dashboard
echo 4. Backend + Web + Mobile (Expo)
echo 5. All services
echo.
set /p choice="Enter your choice (1-5): "

if "%choice%"=="1" goto start_backend
if "%choice%"=="2" goto start_web
if "%choice%"=="3" goto start_backend_web
if "%choice%"=="4" goto start_all
if "%choice%"=="5" goto start_all
echo Invalid choice. Exiting.
exit /b 1

:start_backend
echo.
echo Starting Backend API...
start "Tally System - Backend" cmd /k "cd backend && if exist venv\Scripts\activate.bat (call venv\Scripts\activate.bat) else (python -m venv venv && call venv\Scripts\activate.bat && pip install -r requirements.txt) && alembic upgrade head && uvicorn app.main:app --reload"
echo.
echo Backend starting in new window
echo API will be available at: http://localhost:8000
echo API docs at: http://localhost:8000/docs
goto end

:start_web
echo.
echo Starting Web Dashboard...
start "Tally System - Web Dashboard" cmd /k "cd web && if not exist node_modules (npm install) && if not exist .env (echo VITE_API_URL=http://localhost:8000/api/v1 > .env) && npm run dev"
echo.
echo Web Dashboard starting in new window
echo Dashboard will be available at: http://localhost:3000
goto end

:start_backend_web
echo.
echo Starting Backend API...
start "Tally System - Backend" cmd /k "cd backend && if exist venv\Scripts\activate.bat (call venv\Scripts\activate.bat) else (python -m venv venv && call venv\Scripts\activate.bat && pip install -r requirements.txt) && alembic upgrade head && uvicorn app.main:app --reload"
timeout /t 2 /nobreak >nul
echo Starting Web Dashboard...
start "Tally System - Web Dashboard" cmd /k "cd web && if not exist node_modules (npm install) && if not exist .env (echo VITE_API_URL=http://localhost:8000/api/v1 > .env) && npm run dev"
echo.
echo Backend and Web Dashboard starting in separate windows
echo Backend: http://localhost:8000
echo Dashboard: http://localhost:3000
goto end

:start_all
echo.
echo Starting Backend API...
start "Tally System - Backend" cmd /k "cd backend && if exist venv\Scripts\activate.bat (call venv\Scripts\activate.bat) else (python -m venv venv && call venv\Scripts\activate.bat && pip install -r requirements.txt) && alembic upgrade head && uvicorn app.main:app --reload"
timeout /t 2 /nobreak >nul
echo Starting Web Dashboard...
start "Tally System - Web Dashboard" cmd /k "cd web && if not exist node_modules (npm install) && if not exist .env (echo VITE_API_URL=http://localhost:8000/api/v1 > .env) && npm run dev"
timeout /t 2 /nobreak >nul
echo Starting Mobile App (Expo)...
start "Tally System - Expo" cmd /k "cd mobile && if not exist node_modules (npm install) && npm start"
echo.
echo All services starting in separate windows
echo Backend: http://localhost:8000
echo Dashboard: http://localhost:3000
echo Expo: Running (press 'a' for Android, 'i' for iOS, or scan QR code)
goto end

:end
echo.
echo ========================================
echo   Services are starting...
echo   Check the opened windows for status
echo ========================================
echo.
pause

