@echo off
REM Start Mobile App with Expo

cd mobile

REM Install dependencies if needed
if not exist node_modules (
    echo Installing dependencies...
    npm install
)

REM Start Expo development server
echo Starting Expo development server...
echo Press 'a' for Android, 'i' for iOS, or scan QR code with Expo Go app
npm start

pause

