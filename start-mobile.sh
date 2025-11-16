#!/bin/bash
# Start Mobile App Metro Bundler only

cd mobile

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Start Metro bundler
echo "Starting Metro bundler..."
echo "Note: Run 'npx react-native run-android' in another terminal to launch the app"
npm start

