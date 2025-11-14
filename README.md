# Tally System 2.0

A full-stack inventory management system for tracking chicken parts from plants to customers.

## Tech Stack

- **Backend**: Python 3.11+ with FastAPI, SQLAlchemy, Alembic
- **Web Dashboard**: React 18+ with TypeScript, Vite
- **Mobile App**: React Native with TypeScript
- **Database**: PostgreSQL (production) / SQLite (local dev)
- **Deployment**: Azure App Service (backend), Azure Static Web Apps (frontend)

## Project Structure

```
tally-system-2.0/
├── backend/          # FastAPI backend API
├── web/             # React admin dashboard
├── mobile/           # React Native mobile app
└── .github/          # CI/CD workflows
```

## Quick Start

### Backend

1. Navigate to backend directory:
```bash
cd backend
```

2. Create virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

   **Note:** If you get Rust/Cargo errors, see `INSTALL.md` for solutions. For local development with SQLite, you don't need PostgreSQL drivers.

4. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your database URL
```

5. Run database migrations:
```bash
alembic upgrade head
```

   Note: If you're using SQLite, the initial migration may need adjustments. You can regenerate it with:
   ```bash
   alembic revision --autogenerate -m "Initial migration"
   alembic upgrade head
   ```

6. Start the server:
```bash
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`
API documentation at `http://localhost:8000/docs`

### Web Dashboard

1. Navigate to web directory:
```bash
cd web
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```bash
VITE_API_URL=http://localhost:8000/api/v1
```

4. Start development server:
```bash
npm run dev
```

The dashboard will be available at `http://localhost:3000`

### Mobile App

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
const API_BASE_URL = 'http://YOUR_BACKEND_URL/api/v1';
```

4. Run on Android:
```bash
npx react-native run-android
```

## API Endpoints

### Customers
- `GET /api/v1/customers` - List all customers
- `GET /api/v1/customers/{id}` - Get customer by ID
- `POST /api/v1/customers` - Create customer
- `PUT /api/v1/customers/{id}` - Update customer
- `DELETE /api/v1/customers/{id}` - Delete customer

### Plants
- `GET /api/v1/plants` - List all plants
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
- `GET /api/v1/tally-sessions` - List sessions (supports query params: customer_id, plant_id, status)
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

## Deployment

### Azure Setup

1. **Backend (Azure App Service)**
   - Create an Azure App Service (Linux)
   - Configure environment variables:
     - `DATABASE_URL`: PostgreSQL connection string
     - `API_V1_PREFIX`: `/api/v1`
   - Set up GitHub Actions secrets:
     - `AZURE_WEBAPP_PUBLISH_PROFILE`

2. **Frontend (Azure Static Web Apps)**
   - Create an Azure Static Web App
   - Set up GitHub Actions secrets:
     - `AZURE_STATIC_WEB_APPS_API_TOKEN`
     - `VITE_API_URL`: Your backend API URL

3. **Database (Azure Database for PostgreSQL)**
   - Create PostgreSQL database (free tier available)
   - Update `DATABASE_URL` in backend environment variables

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
```

## License

MIT

