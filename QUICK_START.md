# Quick Start Guide

Get the Tally System running in 5 minutes!

## Prerequisites Check

```bash
# Check Python version (need 3.11+)
python --version

# Check Node version (need 18+)
node --version

# Check npm
npm --version
```

## Step 1: Start Backend (2 minutes)

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Note: If you're using Python 3.13 and get Rust/Cargo errors, 
# the requirements.txt has been updated to use newer pydantic versions with pre-built wheels.

# Run migrations (creates database)
alembic upgrade head

# Start server
uvicorn app.main:app --reload
```

✅ Backend running at: `http://localhost:8000`
✅ API docs at: `http://localhost:8000/docs`

## Step 2: Test Backend (1 minute)

Open `http://localhost:8000/docs` in your browser.

**Quick test:**
1. Click `POST /api/v1/customers`
2. Click "Try it out"
3. Enter: `{"name": "Test Customer"}`
4. Click "Execute"
5. Should see success response!

## Step 3: Start Web Dashboard (1 minute)

Open a **new terminal** (keep backend running):

```bash
cd web

# Install dependencies
npm install

# Start dev server
npm run dev
```

✅ Dashboard running at: `http://localhost:3000`

**Quick test:**
- Open `http://localhost:3000`
- Click "Customers" in sidebar
- Click "Add Customer"
- Enter a name and create
- See it in the list!

## Step 4: Test Mobile App (Optional, 2 minutes)

Open a **new terminal**:

```bash
cd mobile

# Install dependencies
npm install

# IMPORTANT: Update API URL first!
# Edit mobile/src/services/api.ts
# Change: const API_BASE_URL = 'http://10.0.2.2:8000/api/v1';
# (Use 10.0.2.2 for Android emulator, localhost for iOS simulator)

# Run on Android
npx react-native run-android

# OR run on iOS (Mac only)
npx react-native run-ios
```

## Quick Test Workflow

1. **Create data via API** (`http://localhost:8000/docs`):
   - Customer: "ABC Company"
   - Plant: "Main Plant"
   - Weight Classification: "Whole Chicken" (min: 1.0, max: 3.0, category: "Dressed")
   - Tally Session: (customer_id: 1, plant_id: 1, date: "2024-01-15", status: "ongoing")
   - Allocation: (session_id: 1, weight_classification_id: 1, required_bags: 100, allocated_bags: 95)

2. **View in Web Dashboard** (`http://localhost:3000`):
   - See all data in respective pages
   - Add allocations via Session Detail page

3. **View in Mobile App**:
   - See sessions list
   - View session details
   - Add allocations

## Troubleshooting

**Backend won't start:**
- Check if port 8000 is in use: `netstat -an | findstr 8000` (Windows) or `lsof -i :8000` (Mac/Linux)
- Try different port: `uvicorn app.main:app --port 8001`

**Web dashboard can't connect:**
- Make sure backend is running
- Check browser console for errors
- Verify API URL in `.env` file

**Mobile app can't connect:**
- Android emulator: Use `10.0.2.2:8000` instead of `localhost:8000`
- Physical device: Use your computer's IP address (e.g., `192.168.1.100:8000`)

**Migration errors:**
```bash
cd backend
# Delete database file if exists
rm tally_system.db
# Re-run migration
alembic upgrade head
```

## What's Next?

- See `TESTING.md` for comprehensive testing guide
- See `README.md` for full documentation
- Start building your inventory system!

