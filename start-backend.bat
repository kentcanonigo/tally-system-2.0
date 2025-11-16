@echo off
REM Start Backend API only

cd backend

REM Activate virtual environment
if exist venv\Scripts\activate.bat (
    call venv\Scripts\activate.bat
) else (
    echo Creating virtual environment...
    python -m venv venv
    call venv\Scripts\activate.bat
    echo Installing dependencies...
    pip install -r requirements.txt
)

REM Run migrations
echo Running database migrations...
alembic upgrade head

REM Start server
echo Starting FastAPI server...
uvicorn app.main:app --reload

pause

