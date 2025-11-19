#!/bin/bash
# Tally System - Start All Services
# Bash script to start backend, web dashboard, and mobile app

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  Tally System 2.0 - Starting Services${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Check if services are already running
check_port() {
    if command -v lsof > /dev/null 2>&1; then
        lsof -i :$1 > /dev/null 2>&1
    elif command -v netstat > /dev/null 2>&1; then
        netstat -an | grep -q ":$1 "
    else
        false
    fi
}

if check_port 8000; then
    echo -e "${YELLOW}⚠️  Backend is already running on port 8000${NC}"
fi
if check_port 3000; then
    echo -e "${YELLOW}⚠️  Web dashboard is already running on port 3000${NC}"
fi

echo ""
echo -e "${CYAN}Select services to start:${NC}"
echo "1. Backend only"
echo "2. Web Dashboard only"
echo "3. Backend + Web Dashboard"
echo "4. Backend + Web + Mobile (Expo)"
echo "5. All services"
echo ""
read -p "Enter your choice (1-5): " choice

start_backend() {
    echo ""
    echo -e "${YELLOW}🚀 Starting Backend API...${NC}"
    (
        cd backend
        if [ ! -d "venv" ]; then
            echo -e "${YELLOW}⚠️  Virtual environment not found. Creating one...${NC}"
            python3 -m venv venv || python -m venv venv
        fi
        source venv/bin/activate 2>/dev/null || source venv/Scripts/activate 2>/dev/null
        echo -e "${CYAN}Running migrations...${NC}"
        alembic upgrade head
        echo -e "${GREEN}Starting FastAPI server...${NC}"
        uvicorn app.main:app --host 0.0.0.0 --reload
    ) &
    BACKEND_PID=$!
    echo -e "${GREEN}✅ Backend starting (PID: $BACKEND_PID)${NC}"
    echo "   API will be available at: http://localhost:8000"
    echo "   API docs at: http://localhost:8000/docs"
}

start_web() {
    echo ""
    echo -e "${YELLOW}🚀 Starting Web Dashboard...${NC}"
    (
        cd web
        if [ ! -d "node_modules" ]; then
            echo -e "${YELLOW}⚠️  node_modules not found. Installing dependencies...${NC}"
            npm install
        fi
        if [ ! -f ".env" ]; then
            echo -e "${CYAN}Creating .env file...${NC}"
            echo "VITE_API_URL=http://localhost:8000/api/v1" > .env
        fi
        echo -e "${GREEN}Starting Vite dev server...${NC}"
        npm run dev
    ) &
    WEB_PID=$!
    echo -e "${GREEN}✅ Web Dashboard starting (PID: $WEB_PID)${NC}"
    echo "   Dashboard will be available at: http://localhost:3000"
}

start_mobile() {
    echo ""
    echo -e "${YELLOW}🚀 Starting Mobile App (Expo)...${NC}"
    (
        cd mobile
        if [ ! -d "node_modules" ]; then
            echo -e "${YELLOW}⚠️  node_modules not found. Installing dependencies...${NC}"
            npm install
        fi
        echo -e "${GREEN}Starting Expo development server...${NC}"
        echo -e "${YELLOW}⚠️  Press 'a' for Android, 'i' for iOS, or scan QR code with Expo Go app${NC}"
        npm start
    ) &
    MOBILE_PID=$!
    echo -e "${GREEN}✅ Expo starting (PID: $MOBILE_PID)${NC}"
    echo "   Press 'a' for Android, 'i' for iOS, or scan QR code"
}

case $choice in
    1)
        start_backend
        ;;
    2)
        start_web
        ;;
    3)
        start_backend
        sleep 2
        start_web
        ;;
    4)
        start_backend
        sleep 2
        start_web
        sleep 2
        start_mobile
        ;;
    5)
        start_backend
        sleep 2
        start_web
        sleep 2
        start_mobile
        ;;
    *)
        echo -e "${RED}❌ Invalid choice. Exiting.${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  Services are starting...${NC}"
echo -e "${CYAN}  Check the terminal output for status${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for user interrupt
trap "echo ''; echo 'Stopping services...'; kill $BACKEND_PID $WEB_PID $MOBILE_PID 2>/dev/null; exit" INT TERM
wait

