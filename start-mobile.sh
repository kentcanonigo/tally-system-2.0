#!/bin/bash
# Start Mobile App with Expo

cd mobile

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Start Expo development server
echo "Starting Expo development server..."
echo "Press 'a' for Android, 'i' for iOS, or scan QR code with Expo Go app"
npm start

