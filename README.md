# Tally System 2.0

A full-stack inventory management system for tracking chicken parts from plants to customers.

## Tech Stack

- **Backend**: Python 3.11+ with FastAPI, SQLAlchemy, Alembic
- **Web Dashboard**: React 18+ with TypeScript, Vite
- **Mobile App**: React Native with TypeScript
- **Database**: Azure SQL Database (production) / SQLite (local dev)
- **Deployment**: Azure App Service (backend), Azure Static Web Apps (frontend)

## Project Structure

```
tally-system-2.0/
├── backend/          # FastAPI backend API
├── web/             # React admin dashboard
├── mobile/           # React Native mobile app
└── .github/          # CI/CD workflows
```

## 🚀 Getting Started

**⚠️ Important: Always test locally first before deploying to Azure!**

### Quick Start Options

1. **Use Startup Scripts (Easiest)** - See [SCRIPTS.md](SCRIPTS.md)
   - Windows: Double-click `start-all.bat` or run `start-all.ps1`
   - Git Bash/Linux/Mac: Run `./start-all.sh`
   - Choose which services to start from a menu

2. **Manual Setup** - See [Quick Start Guide](QUICK_START.md) for step-by-step instructions

3. **Comprehensive Testing** - See [Testing Guide](TESTING.md) for detailed testing instructions

### Prerequisites

- Python 3.11+ (3.13+ supported)
- Node.js 18+
- Git

## Local Development Setup

### Step 1: Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Create virtual environment:
```bash
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

   **Note:** 
   - For local development with SQLite, PostgreSQL drivers are not required
   - If you encounter Rust/Cargo errors with Python 3.13, the requirements have been updated with compatible versions
   - See `INSTALL.md` for troubleshooting

4. Set up environment variables:
```bash
# Create .env file (or copy from .env.example if available)
# For local SQLite development (default):
DATABASE_URL=sqlite:///./tally_system.db
API_V1_PREFIX=/api/v1
DEBUG=True
```

5. Run database migrations:
```bash
alembic upgrade head
```

   This creates the SQLite database and all tables.

6. Start the development server:
```bash
uvicorn app.main:app --reload
```

✅ **Backend running at:** `http://localhost:8000`  
✅ **API documentation at:** `http://localhost:8000/docs`  
✅ **Health check at:** `http://localhost:8000/health`

### Step 2: Test Backend Locally

**Quick Test (Recommended):**
1. Open `http://localhost:8000/docs` in your browser
2. Use the interactive Swagger UI to test endpoints
3. Try creating a customer: `POST /api/v1/customers` with `{"name": "Test Customer"}`

**Or use curl:**
```bash
# Health check
curl http://localhost:8000/health

# Create a customer
curl -X POST "http://localhost:8000/api/v1/customers" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Customer"}'
```

📖 **For detailed testing instructions, see [TESTING.md](TESTING.md)**

### Step 3: Web Dashboard Setup

1. Navigate to web directory (in a **new terminal**):
```bash
cd web
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file (optional, defaults to localhost):
```bash
# .env
VITE_API_URL=http://localhost:8000/api/v1
```

4. Start development server:
```bash
npm run dev
```

✅ **Dashboard running at:** `http://localhost:3000`

**Quick Test:**
- Open `http://localhost:3000`
- Navigate to "Customers" and create a test customer
- Verify it appears in the list

### Step 4: Mobile App Setup (Optional)

1. Navigate to mobile directory:
```bash
cd mobile
```

2. Install dependencies:
```bash
npm install
```

3. Update API URL in `src/services/api.ts`:
```typescript
// For Android emulator:
const API_BASE_URL = 'http://10.0.2.2:8000/api/v1';

// For iOS simulator:
const API_BASE_URL = 'http://localhost:8000/api/v1';

// For physical device, use your computer's IP:
const API_BASE_URL = 'http://192.168.1.XXX:8000/api/v1';
```

4. Run on Android:
```bash
npx react-native run-android
```

## Local Testing Workflow

**Before deploying, ensure everything works locally:**

1. ✅ Backend API starts and responds to health checks
2. ✅ Can create/read/update/delete customers via API
3. ✅ Can create/read/update/delete plants via API
4. ✅ Can create weight classifications and tally sessions
5. ✅ Web dashboard connects to backend and displays data
6. ✅ Can perform CRUD operations via web dashboard
7. ✅ Mobile app (if testing) can connect and view data

See [TESTING.md](TESTING.md) for a complete testing checklist and detailed instructions.

## API Endpoints

### Health & Info
- `GET /health` - Basic health check
- `GET /health/db` - Database connectivity check
- `GET /docs` - Interactive API documentation (Swagger UI)
- `GET /redoc` - Alternative API documentation (ReDoc)

### Customers
- `GET /api/v1/customers` - List all customers (supports `skip` and `limit` query params)
- `GET /api/v1/customers/{id}` - Get customer by ID
- `POST /api/v1/customers` - Create customer
- `PUT /api/v1/customers/{id}` - Update customer
- `DELETE /api/v1/customers/{id}` - Delete customer

### Plants
- `GET /api/v1/plants` - List all plants (supports `skip` and `limit` query params)
- `GET /api/v1/plants/{id}` - Get plant by ID
- `POST /api/v1/plants` - Create plant
- `PUT /api/v1/plants/{id}` - Update plant
- `DELETE /api/v1/plants/{id}` - Delete plant

### Weight Classifications
- `GET /api/v1/plants/{plant_id}/weight-classifications` - List classifications for a plant
- `GET /api/v1/weight-classifications/{id}` - Get classification by ID
- `POST /api/v1/plants/{plant_id}/weight-classifications` - Create classification
- `PUT /api/v1/weight-classifications/{id}` - Update classification
- `DELETE /api/v1/weight-classifications/{id}` - Delete classification

### Tally Sessions
- `GET /api/v1/tally-sessions` - List sessions (supports query params: `customer_id`, `plant_id`, `status`, `skip`, `limit`)
- `GET /api/v1/tally-sessions/{id}` - Get session by ID
- `POST /api/v1/tally-sessions` - Create session
- `PUT /api/v1/tally-sessions/{id}` - Update session
- `DELETE /api/v1/tally-sessions/{id}` - Delete session

### Allocation Details
- `GET /api/v1/tally-sessions/{session_id}/allocations` - List allocations for a session
- `GET /api/v1/allocations/{id}` - Get allocation by ID
- `POST /api/v1/tally-sessions/{session_id}/allocations` - Create allocation
- `PUT /api/v1/allocations/{id}` - Update allocation
- `DELETE /api/v1/allocations/{id}` - Delete allocation

## Database Compatibility

The system supports multiple databases:

- **SQLite** (default for local development) - No setup required, works out of the box
- **Azure SQL Database** (production) - Requires connection string configuration
- **PostgreSQL** (optional) - Supported but not required for local development

**Important Notes:**
- SQL Server (Azure SQL) requires `ORDER BY` clauses when using `OFFSET`/`LIMIT` - this is already handled in the code
- String columns have explicit lengths for SQL Server compatibility
- Migrations are compatible with all supported databases

## Deployment to Azure

**⚠️ Only deploy after successful local testing!**

### Prerequisites
- Azure account (free tier available)
- GitHub repository with code pushed
- All local tests passing

### Quick Deployment Guide

See [AZURE_QUICK_START.md](AZURE_QUICK_START.md) for a streamlined deployment guide, or [AZURE_DEPLOYMENT.md](AZURE_DEPLOYMENT.md) for detailed instructions.

**Summary:**
1. **Database**: Create Azure SQL Database (free tier available)
2. **Backend**: Deploy to Azure App Service (Linux)
3. **Frontend**: Deploy to Azure Static Web Apps
4. **CI/CD**: GitHub Actions workflows handle automatic deployments

### Azure Services Used

- **Azure SQL Database** (Basic tier, free tier eligible)
- **Azure App Service** (Linux, Free tier)
- **Azure Static Web Apps** (Free tier)

### Environment Variables for Azure

**Backend (Azure App Service):**
- `DATABASE_URL`: Azure SQL Database connection string (SQLAlchemy format)
- `CORS_ORIGINS`: Comma-separated list of allowed origins (or `*` for all)
- `DEBUG`: Set to `False` for production

**Frontend (GitHub Secrets):**
- `VITE_API_URL`: Your Azure backend API URL (e.g., `https://your-api.azurewebsites.net/api/v1`)

## Development

### Running Tests

```bash
# Backend tests (when implemented)
cd backend
pytest

# Frontend tests (when implemented)
cd web
npm test
```

### Database Migrations

```bash
cd backend

# Create a new migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback migration
alembic downgrade -1

# Check migration status
alembic current
alembic history
```

### Code Structure

- **Backend**: FastAPI with SQLAlchemy ORM, Alembic for migrations
- **Frontend**: React with TypeScript, Vite for build tooling
- **Mobile**: React Native with TypeScript
- **API**: RESTful API with OpenAPI/Swagger documentation

## Troubleshooting

### Backend Issues

**Port already in use:**
```bash
# Use a different port
uvicorn app.main:app --port 8001
```

**Migration errors:**
```bash
cd backend
# Delete SQLite database if exists
rm tally_system.db
# Re-run migration
alembic upgrade head
```

**Python 3.13 compatibility:**
- Requirements have been updated for Python 3.13 compatibility
- If issues persist, see `INSTALL.md`

### Web Dashboard Issues

**API connection errors:**
- Verify backend is running on `http://localhost:8000`
- Check `VITE_API_URL` in `.env` file
- Check browser console for CORS errors
- Ensure backend CORS is configured correctly

### Mobile App Issues

**Cannot connect to API:**
- Android emulator: Use `10.0.2.2` instead of `localhost`
- Physical device: Use your computer's local IP address
- Check firewall settings

### Azure Deployment Issues

See [AZURE_DEPLOYMENT.md](AZURE_DEPLOYMENT.md) for detailed troubleshooting.

Common issues:
- Database connection string format (SQLAlchemy vs ADO.NET)
- CORS configuration
- Environment variables not set correctly
- GitHub Actions secrets not configured

## Additional Resources

- [Quick Start Guide](QUICK_START.md) - Get running in 5 minutes
- [Testing Guide](TESTING.md) - Comprehensive testing instructions
- [Azure Deployment Guide](AZURE_DEPLOYMENT.md) - Detailed Azure setup
- [Azure Quick Start](AZURE_QUICK_START.md) - Streamlined Azure deployment

## License

MIT
