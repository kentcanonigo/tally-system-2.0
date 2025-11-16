@echo off
REM Start Mobile App Metro Bundler only

cd mobile

REM Install dependencies if needed
if not exist node_modules (
    echo Installing dependencies...
    npm install
)

REM Start Metro bundler
echo Starting Metro bundler...
echo Note: Run 'npx react-native run-android' in another terminal to launch the app
npm start

pause

