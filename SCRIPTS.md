# Startup Scripts Guide

This directory contains scripts to help you start all services locally with ease.

## Quick Start

### Windows (Recommended)

**Option 1: Double-click `start-all.bat`**
- Simple batch file that opens separate windows for each service
- Choose which services to start from a menu

**Option 2: Run PowerShell script**
```powershell
.\start-all.ps1
```
- More features and better error handling
- Checks if services are already running

### Git Bash / Linux / Mac

```bash
./start-all.sh
```

## Available Scripts

### All-in-One Scripts

| Script | Platform | Description |
|--------|----------|-------------|
| `start-all.bat` | Windows | Batch file to start all services |
| `start-all.ps1` | Windows | PowerShell script (more features) |
| `start-all.sh` | Git Bash/Unix | Bash script for Unix-like systems |

### Individual Service Scripts

| Script | Platform | Description |
|--------|----------|-------------|
| `start-backend.bat` / `.sh` | Both | Start backend API only |
| `start-web.bat` / `.sh` | Both | Start web dashboard only |
| `start-mobile.bat` / `.sh` | Both | Start mobile Metro bundler only |

## Usage

### Starting All Services

**Windows:**
```cmd
REM Double-click start-all.bat or run:
start-all.bat

REM Or use PowerShell:
powershell -ExecutionPolicy Bypass -File start-all.ps1
```

**Git Bash / Linux / Mac:**
```bash
./start-all.sh
```

### Starting Individual Services

**Backend only:**
```cmd
REM Windows
start-backend.bat

REM Git Bash
./start-backend.sh
```

**Web Dashboard only:**
```cmd
REM Windows
start-web.bat

REM Git Bash
./start-web.sh
```

**Mobile Metro Bundler only:**
```cmd
REM Windows
start-mobile.bat

REM Git Bash
./start-mobile.sh
```

## What the Scripts Do

### Backend Script
1. Checks for virtual environment, creates one if missing
2. Installs dependencies if needed
3. Runs database migrations (`alembic upgrade head`)
4. Starts FastAPI server with auto-reload

### Web Dashboard Script
1. Checks for `node_modules`, installs if missing
2. Creates `.env` file with API URL if missing
3. Starts Vite development server

### Mobile Script
1. Checks for `node_modules`, installs if missing
2. Starts Metro bundler
3. Note: You still need to run `npx react-native run-android` or `npx react-native run-ios` separately

## Service URLs

Once started, services will be available at:

- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **Web Dashboard**: http://localhost:3000
- **Metro Bundler**: http://localhost:8081 (default React Native port)

## Troubleshooting

### Scripts won't run on Windows

**PowerShell execution policy:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Or run with bypass:**
```powershell
powershell -ExecutionPolicy Bypass -File start-all.ps1
```

### Scripts won't run on Git Bash

Make sure scripts are executable:
```bash
chmod +x *.sh
```

### Port already in use

If you see "port already in use" errors:
- **Backend (8000)**: Stop any existing FastAPI/uvicorn processes
- **Web (3000)**: Stop any existing Vite/React dev servers
- **Mobile (8081)**: Stop any existing Metro bundlers

**Windows:**
```cmd
REM Find process using port 8000
netstat -ano | findstr :8000
REM Kill process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

**Git Bash / Linux:**
```bash
# Find process using port 8000
lsof -ti:8000
# Kill process
kill -9 $(lsof -ti:8000)
```

### Virtual environment issues

If the backend script can't find the virtual environment:
```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Git Bash:
source venv/Scripts/activate
pip install -r requirements.txt
```

### Node modules issues

If npm install fails:
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

## Manual Start (Alternative)

If scripts don't work, you can start services manually:

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate  # or venv\Scripts\activate on Windows
alembic upgrade head
uvicorn app.main:app --reload
```

**Terminal 2 - Web:**
```bash
cd web
npm run dev
```

**Terminal 3 - Mobile:**
```bash
cd mobile
npm start
```

## Next Steps

Once services are running:
1. Test backend at http://localhost:8000/docs
2. Open web dashboard at http://localhost:3000
3. For mobile: Run `npx react-native run-android` or `npx react-native run-ios` in another terminal

See [TESTING.md](TESTING.md) for detailed testing instructions.

