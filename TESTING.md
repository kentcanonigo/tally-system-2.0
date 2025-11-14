# Testing Guide - Tally System 2.0

This guide will help you test all components of the Tally System.

## Prerequisites

- Python 3.11+ installed
- Node.js 18+ installed
- For mobile: Android Studio or Xcode (for iOS) installed

## Step 1: Backend API Testing

### 1.1 Setup Backend

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file (or copy from .env.example)
# For SQLite (default):
DATABASE_URL=sqlite:///./tally_system.db
API_V1_PREFIX=/api/v1
DEBUG=True

# Run migrations
alembic upgrade head

# Start the server
uvicorn app.main:app --reload
```

The API will start at `http://localhost:8000`

### 1.2 Test Backend API

#### Option A: Using FastAPI Interactive Docs (Recommended)

1. Open your browser and go to: `http://localhost:8000/docs`
2. This provides an interactive Swagger UI where you can test all endpoints
3. Try these endpoints in order:

**1. Create a Customer:**
- Click on `POST /api/v1/customers`
- Click "Try it out"
- Enter JSON:
```json
{
  "name": "ABC Poultry Company"
}
```
- Click "Execute"
- Note the `id` returned (e.g., `1`)

**2. Create a Plant:**
- Click on `POST /api/v1/plants`
- Click "Try it out"
- Enter JSON:
```json
{
  "name": "Main Processing Plant"
}
```
- Click "Execute"
- Note the `id` returned (e.g., `1`)

**3. Create Weight Classification:**
- Click on `POST /api/v1/plants/{plant_id}/weight-classifications`
- Click "Try it out"
- Set `plant_id` to `1` (the plant ID from step 2)
- Enter JSON:
```json
{
  "plant_id": 1,
  "classification": "Whole Chicken",
  "min_weight": 1.0,
  "max_weight": 3.0,
  "category": "Dressed"
}
```
- Click "Execute"

**4. Create Another Weight Classification:**
- Same endpoint, enter:
```json
{
  "plant_id": 1,
  "classification": "Chicken Wings",
  "min_weight": 0.5,
  "max_weight": 1.0,
  "category": "Byproduct"
}
```

**5. Create a Tally Session:**
- Click on `POST /api/v1/tally-sessions`
- Enter JSON:
```json
{
  "customer_id": 1,
  "plant_id": 1,
  "date": "2024-01-15",
  "status": "ongoing"
}
```
- Click "Execute"
- Note the `id` returned (e.g., `1`)

**6. Create Allocation Details:**
- Click on `POST /api/v1/tally-sessions/{session_id}/allocations`
- Set `session_id` to `1`
- Enter JSON:
```json
{
  "tally_session_id": 1,
  "weight_classification_id": 1,
  "required_bags": 100,
  "allocated_bags": 95
}
```
- Click "Execute"

**7. View All Data:**
- Use `GET` endpoints to retrieve all the data you created
- Try filtering tally sessions: `GET /api/v1/tally-sessions?status=ongoing`

#### Option B: Using curl (Command Line)

```bash
# Create Customer
curl -X POST "http://localhost:8000/api/v1/customers" \
  -H "Content-Type: application/json" \
  -d '{"name": "ABC Poultry Company"}'

# Create Plant
curl -X POST "http://localhost:8000/api/v1/plants" \
  -H "Content-Type: application/json" \
  -d '{"name": "Main Processing Plant"}'

# Create Weight Classification
curl -X POST "http://localhost:8000/api/v1/plants/1/weight-classifications" \
  -H "Content-Type: application/json" \
  -d '{
    "plant_id": 1,
    "classification": "Whole Chicken",
    "min_weight": 1.0,
    "max_weight": 3.0,
    "category": "Dressed"
  }'

# Create Tally Session
curl -X POST "http://localhost:8000/api/v1/tally-sessions" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": 1,
    "plant_id": 1,
    "date": "2024-01-15",
    "status": "ongoing"
  }'

# Create Allocation
curl -X POST "http://localhost:8000/api/v1/tally-sessions/1/allocations" \
  -H "Content-Type: application/json" \
  -d '{
    "tally_session_id": 1,
    "weight_classification_id": 1,
    "required_bags": 100,
    "allocated_bags": 95
  }'

# Get all customers
curl "http://localhost:8000/api/v1/customers"

# Get all tally sessions
curl "http://localhost:8000/api/v1/tally-sessions"
```

#### Option C: Using Postman

1. Import the API collection (or manually create requests)
2. Base URL: `http://localhost:8000/api/v1`
3. Follow the same sequence as Option A

### 1.3 Verify Backend Health

```bash
# Health check
curl http://localhost:8000/health

# Root endpoint
curl http://localhost:8000/
```

## Step 2: Web Dashboard Testing

### 2.1 Setup Web Dashboard

```bash
# Navigate to web directory
cd web

# Install dependencies
npm install

# Create .env file (optional, defaults to localhost:8000)
echo "VITE_API_URL=http://localhost:8000/api/v1" > .env

# Start development server
npm run dev
```

The dashboard will start at `http://localhost:3000`

### 2.2 Test Web Dashboard

1. **Open Dashboard:**
   - Navigate to `http://localhost:3000`
   - You should see the dashboard with statistics

2. **Test Customers Page:**
   - Click "Customers" in the sidebar
   - Click "Add Customer"
   - Enter a name (e.g., "XYZ Food Distributors")
   - Click "Create"
   - Verify the customer appears in the table
   - Try editing and deleting

3. **Test Plants Page:**
   - Click "Plants" in the sidebar
   - Add a plant (e.g., "Secondary Plant")
   - Verify CRUD operations work

4. **Test Weight Classifications:**
   - Click "Weight Classifications"
   - Select a plant from the dropdown
   - Click "Add Weight Classification"
   - Fill in the form:
     - Classification: "Chicken Thighs"
     - Min Weight: 0.3
     - Max Weight: 0.8
     - Category: "Byproduct"
   - Click "Create"
   - Verify it appears in the list

5. **Test Tally Sessions:**
   - Click "Tally Sessions"
   - You should see sessions created via API
   - Try filtering by customer, plant, or status
   - Click "View Details" on a session
   - On the detail page, click "Add Allocation"
   - Select a weight classification
   - Enter required and allocated bags
   - Click "Save"
   - Verify the allocation appears
   - Try marking a session as "Complete"

6. **Test End-to-End Workflow:**
   - Create a new customer via the dashboard
   - Create a new plant
   - Add weight classifications for that plant
   - Create a new tally session (via API or add this feature to dashboard)
   - Add allocations to the session
   - Update allocation values
   - Mark session as completed

## Step 3: Mobile App Testing

### 3.1 Setup Mobile App

```bash
# Navigate to mobile directory
cd mobile

# Install dependencies
npm install

# For Android:
# Make sure Android emulator is running or device is connected
npx react-native run-android

# For iOS (Mac only):
# Make sure iOS simulator is running
npx react-native run-ios
```

### 3.2 Update API URL

Before running, update the API URL in `mobile/src/services/api.ts`:

```typescript
// For Android emulator, use:
const API_BASE_URL = 'http://10.0.2.2:8000/api/v1';

// For iOS simulator, use:
const API_BASE_URL = 'http://localhost:8000/api/v1';

// For physical device, use your computer's IP:
const API_BASE_URL = 'http://192.168.1.XXX:8000/api/v1';
```

### 3.3 Test Mobile App

1. **Home Screen:**
   - Should display statistics (customers, plants, sessions, ongoing)
   - Tap "Create New Session" button

2. **Create Tally Session:**
   - Select a customer
   - Select a plant
   - Set the date
   - Tap "Create Session"
   - Should navigate back to sessions list

3. **Tally Sessions List:**
   - Should show all sessions
   - Pull down to refresh
   - Tap on a session to view details

4. **Session Detail:**
   - View session information
   - Tap "Add Allocation"
   - Select weight classification
   - Enter required and allocated bags
   - Tap "Save"
   - Verify allocation appears
   - Tap "Mark Complete" to change status

5. **Test Offline Caching:**
   - Load some data
   - Turn off WiFi/mobile data
   - App should still show cached data (basic implementation)

## Step 4: Integration Testing

### 4.1 Complete Workflow Test

1. **Via API (Backend):**
   ```bash
   # Create customer
   curl -X POST "http://localhost:8000/api/v1/customers" \
     -H "Content-Type: application/json" \
     -d '{"name": "Test Customer"}'
   
   # Create plant
   curl -X POST "http://localhost:8000/api/v1/plants" \
     -H "Content-Type: application/json" \
     -d '{"name": "Test Plant"}'
   
   # Create weight classification
   curl -X POST "http://localhost:8000/api/v1/plants/1/weight-classifications" \
     -H "Content-Type: application/json" \
     -d '{
       "plant_id": 1,
       "classification": "Test Classification",
       "min_weight": 1.0,
       "max_weight": 2.0,
       "category": "Test"
     }'
   
   # Create tally session
   curl -X POST "http://localhost:8000/api/v1/tally-sessions" \
     -H "Content-Type: application/json" \
     -d '{
       "customer_id": 1,
       "plant_id": 1,
       "date": "2024-01-20",
       "status": "ongoing"
     }'
   ```

2. **Via Web Dashboard:**
   - View the created data
   - Add allocations to the session
   - Update session status

3. **Via Mobile App:**
   - View the same session
   - Add more allocations
   - Verify data syncs across all platforms

### 4.2 Error Handling Test

Test error scenarios:

```bash
# Try to create allocation with invalid session ID
curl -X POST "http://localhost:8000/api/v1/tally-sessions/999/allocations" \
  -H "Content-Type: application/json" \
  -d '{
    "tally_session_id": 999,
    "weight_classification_id": 1,
    "required_bags": 100,
    "allocated_bags": 95
  }'

# Should return 404 error

# Try to create weight classification with invalid weight range
curl -X POST "http://localhost:8000/api/v1/plants/1/weight-classifications" \
  -H "Content-Type: application/json" \
  -d '{
    "plant_id": 1,
    "classification": "Invalid",
    "min_weight": 5.0,
    "max_weight": 2.0,
    "category": "Test"
  }'

# Should return validation error
```

## Step 5: Performance Testing

### 5.1 Load Test (Optional)

Use a tool like Apache Bench or wrk:

```bash
# Test GET endpoint performance
ab -n 1000 -c 10 http://localhost:8000/api/v1/customers

# Test POST endpoint performance
ab -n 100 -c 5 -p customer.json -T application/json \
  http://localhost:8000/api/v1/customers
```

## Troubleshooting

### Backend Issues

**Migration errors:**
```bash
# If migration fails, try regenerating
cd backend
alembic revision --autogenerate -m "Fix migration"
alembic upgrade head
```

**Port already in use:**
```bash
# Change port in uvicorn command
uvicorn app.main:app --port 8001
```

### Web Dashboard Issues

**API connection errors:**
- Check that backend is running
- Verify `VITE_API_URL` in `.env` matches backend URL
- Check browser console for CORS errors

### Mobile App Issues

**Cannot connect to API:**
- For Android emulator: Use `10.0.2.2` instead of `localhost`
- For physical device: Use your computer's local IP address
- Check firewall settings

**Build errors:**
```bash
# Clean and rebuild
cd mobile
npm start -- --reset-cache
npx react-native run-android
```

## Quick Test Checklist

- [ ] Backend API starts successfully
- [ ] Can create customer via API
- [ ] Can create plant via API
- [ ] Can create weight classification via API
- [ ] Can create tally session via API
- [ ] Can create allocation via API
- [ ] Web dashboard loads
- [ ] Can create customer via dashboard
- [ ] Can view tally sessions
- [ ] Can add allocations via dashboard
- [ ] Mobile app builds and runs
- [ ] Mobile app can view sessions
- [ ] Mobile app can create sessions
- [ ] Mobile app can add allocations
- [ ] Data syncs between API, web, and mobile

## Next Steps

Once testing is complete:
1. Review any errors or issues
2. Add unit tests for backend (pytest)
3. Add integration tests
4. Set up CI/CD pipeline
5. Deploy to Azure

