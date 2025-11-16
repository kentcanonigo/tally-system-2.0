@echo off
REM Start Web Dashboard only

cd web

REM Install dependencies if needed
if not exist node_modules (
    echo Installing dependencies...
    npm install
)

REM Create .env if it doesn't exist
if not exist .env (
    echo Creating .env file...
    echo VITE_API_URL=http://localhost:8000/api/v1 > .env
)

REM Start dev server
echo Starting Vite dev server...
npm run dev

pause

