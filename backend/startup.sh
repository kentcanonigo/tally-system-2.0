#!/bin/bash
# Startup script for Azure App Service
# This runs migrations and starts the server

echo "Running database migrations..."
cd /home/site/wwwroot
alembic upgrade head

echo "Starting FastAPI server..."
uvicorn app.main:app --host 0.0.0.0 --port 8000

