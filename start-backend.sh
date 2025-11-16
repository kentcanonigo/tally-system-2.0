#!/bin/bash
# Start Backend API only

cd backend

# Activate virtual environment
if [ -d "venv" ]; then
    source venv/bin/activate 2>/dev/null || source venv/Scripts/activate 2>/dev/null
else
    echo "Creating virtual environment..."
    python3 -m venv venv || python -m venv venv
    source venv/bin/activate 2>/dev/null || source venv/Scripts/activate 2>/dev/null
    echo "Installing dependencies..."
    pip install -r requirements.txt
fi

# Run migrations
echo "Running database migrations..."
alembic upgrade head

# Start server
echo "Starting FastAPI server..."
uvicorn app.main:app --reload

