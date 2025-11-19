# Tally System - Start All Services
# PowerShell script to start backend, web dashboard, and mobile app

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Tally System 2.0 - Starting Services" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if services are already running
$backendRunning = Test-NetConnection -ComputerName localhost -Port 8000 -InformationLevel Quiet -WarningAction SilentlyContinue
$webRunning = Test-NetConnection -ComputerName localhost -Port 3000 -InformationLevel Quiet -WarningAction SilentlyContinue

if ($backendRunning) {
    Write-Host "⚠️  Backend is already running on port 8000" -ForegroundColor Yellow
}
if ($webRunning) {
    Write-Host "⚠️  Web dashboard is already running on port 3000" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Starting services in separate windows..." -ForegroundColor Green
Write-Host ""

# Function to start backend
function Start-Backend {
    Write-Host "🚀 Starting Backend API..." -ForegroundColor Yellow
    $backendScript = @"
cd backend
if (Test-Path venv\Scripts\Activate.ps1) {
    & .\venv\Scripts\Activate.ps1
} else {
    Write-Host "⚠️  Virtual environment not found. Creating one..." -ForegroundColor Yellow
    python -m venv venv
    & .\venv\Scripts\Activate.ps1
    pip install -r requirements.txt
}
Write-Host "Running migrations..." -ForegroundColor Cyan
alembic upgrade head
Write-Host "Starting FastAPI server..." -ForegroundColor Green
uvicorn app.main:app --host 0.0.0.0 --reload
pause
"@
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendScript
}

# Function to start web dashboard
function Start-Web {
    Write-Host "🚀 Starting Web Dashboard..." -ForegroundColor Yellow
    $webScript = @"
cd web
if (-not (Test-Path node_modules)) {
    Write-Host "⚠️  node_modules not found. Installing dependencies..." -ForegroundColor Yellow
    npm install
}
if (-not (Test-Path .env)) {
    Write-Host "Creating .env file..." -ForegroundColor Cyan
    "VITE_API_URL=http://localhost:8000/api/v1" | Out-File -FilePath .env -Encoding utf8
}
Write-Host "Starting Vite dev server..." -ForegroundColor Green
npm run dev
pause
"@
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $webScript
}

# Function to start mobile app (Expo)
function Start-Mobile {
    Write-Host "🚀 Starting Mobile App (Expo)..." -ForegroundColor Yellow
    $mobileScript = @"
cd mobile
if (-not (Test-Path node_modules)) {
    Write-Host "⚠️  node_modules not found. Installing dependencies..." -ForegroundColor Yellow
    npm install
}
Write-Host "Starting Expo development server..." -ForegroundColor Green
Write-Host "⚠️  Press 'a' for Android, 'i' for iOS, or scan QR code with Expo Go app" -ForegroundColor Yellow
npm start
pause
"@
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $mobileScript
}

# Main menu
Write-Host "Select services to start:" -ForegroundColor Cyan
Write-Host "1. Backend only" -ForegroundColor White
Write-Host "2. Web Dashboard only" -ForegroundColor White
Write-Host "3. Backend + Web Dashboard" -ForegroundColor White
Write-Host "4. Backend + Web + Mobile (Expo)" -ForegroundColor White
Write-Host "5. All services" -ForegroundColor White
Write-Host ""
$choice = Read-Host "Enter your choice (1-5)"

switch ($choice) {
    "1" {
        Start-Backend
        Write-Host ""
        Write-Host "✅ Backend starting in new window" -ForegroundColor Green
        Write-Host "   API will be available at: http://localhost:8000" -ForegroundColor Gray
        Write-Host "   API docs at: http://localhost:8000/docs" -ForegroundColor Gray
    }
    "2" {
        Start-Web
        Write-Host ""
        Write-Host "✅ Web Dashboard starting in new window" -ForegroundColor Green
        Write-Host "   Dashboard will be available at: http://localhost:3000" -ForegroundColor Gray
    }
    "3" {
        Start-Backend
        Start-Sleep -Seconds 2
        Start-Web
        Write-Host ""
        Write-Host "✅ Backend and Web Dashboard starting in separate windows" -ForegroundColor Green
        Write-Host "   Backend: http://localhost:8000" -ForegroundColor Gray
        Write-Host "   Dashboard: http://localhost:3000" -ForegroundColor Gray
    }
    "4" {
        Start-Backend
        Start-Sleep -Seconds 2
        Start-Web
        Start-Sleep -Seconds 2
        Start-Mobile
        Write-Host ""
        Write-Host "✅ All services starting in separate windows" -ForegroundColor Green
        Write-Host "   Backend: http://localhost:8000" -ForegroundColor Gray
        Write-Host "   Dashboard: http://localhost:3000" -ForegroundColor Gray
        Write-Host "   Expo: Running (press 'a' for Android, 'i' for iOS, or scan QR code)" -ForegroundColor Gray
    }
    "5" {
        Start-Backend
        Start-Sleep -Seconds 2
        Start-Web
        Start-Sleep -Seconds 2
        Start-Mobile
        Write-Host ""
        Write-Host "✅ All services starting in separate windows" -ForegroundColor Green
        Write-Host "   Backend: http://localhost:8000" -ForegroundColor Gray
        Write-Host "   Dashboard: http://localhost:3000" -ForegroundColor Gray
        Write-Host "   Expo: Running (press 'a' for Android, 'i' for iOS, or scan QR code)" -ForegroundColor Gray
    }
    default {
        Write-Host "❌ Invalid choice. Exiting." -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Services are starting..." -ForegroundColor Cyan
Write-Host "  Check the opened windows for status" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to exit this window (services will continue running)..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

