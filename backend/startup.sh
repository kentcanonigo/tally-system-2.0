#!/bin/bash
# Startup script for Azure App Service
# Oryx will handle dependency installation, this just runs migrations and starts server

# Activate virtual environment if it exists
if [ -d "/home/site/wwwroot/antenv" ]; then
    source /home/site/wwwroot/antenv/bin/activate
fi

# Change to app directory
cd /home/site/wwwroot

# Run migrations
echo "Running database migrations..."
alembic upgrade head

# Seed admin user (idempotent - safe to run multiple times)
echo "Ensuring default admin user exists..."
python seed_admin.py

# Start the server
echo "Starting FastAPI server..."
uvicorn app.main:app --host 0.0.0.0 --port 8000
