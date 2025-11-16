#!/bin/bash
# Start Web Dashboard only

cd web

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Create .env if it doesn't exist
if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    echo "VITE_API_URL=http://localhost:8000/api/v1" > .env
fi

# Start dev server
echo "Starting Vite dev server..."
npm run dev

