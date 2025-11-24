# Backend Developer Guide

This document provides comprehensive information about the Tally System backend API, including data models, business rules, guards, and important implementation details.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Authentication & Authorization](#authentication--authorization)
4. [Database Models & Relationships](#database-models--relationships)
5. [Destructive Operation Guards](#destructive-operation-guards)
6. [Business Logic Rules](#business-logic-rules)
7. [API Structure](#api-structure)
8. [Important Implementation Details](#important-implementation-details)
9. [Configuration](#configuration)

---

## Overview

The Tally System backend is a FastAPI-based REST API for managing chicken parts inventory. It handles:
- Customers and Plants
- Weight Classifications (Dressed/Byproduct categories)
- Tally Sessions (daily inventory tracking)
- Allocation Details (bag requirements and allocations)
- Tally Log Entries (individual bag/item entries)

**Tech Stack:**
- FastAPI (Python web framework)
- SQLAlchemy (ORM)
- Alembic (database migrations)
- Supports SQLite (local) and Azure SQL Database (production)

---

## Architecture

### Project Structure

```
backend/
├── app/
│   ├── api/
│   │   └── routes/          # API endpoint definitions
│   ├── crud/                # Database operations (business logic)
│   ├── models/              # SQLAlchemy models
│   ├── schemas/             # Pydantic schemas (request/response)
│   ├── config.py            # Configuration settings
│   ├── database.py          # Database connection setup
│   └── main.py              # FastAPI app initialization
├── alembic/                 # Database migrations
└── requirements.txt         # Python dependencies
```

### Key Principles

1. **CRUD Layer**: All database operations go through CRUD functions in `app/crud/`
2. **API Layer**: Routes in `app/api/routes/` handle HTTP requests and call CRUD functions
3. **Validation**: Pydantic schemas validate request/response data
4. **Guards**: Destructive operations have explicit guards to prevent data loss

---

## Authentication & Authorization

The Tally System implements **JWT-based authentication** with **role-based access control (RBAC)**.

### Quick Overview

- **Authentication Method**: JWT (JSON Web Tokens)
- **Password Hashing**: bcrypt
- **Token Lifetime**: 8 hours (default)
- **Roles**: SUPERADMIN (full access) and ADMIN (plant-specific access)

### User Roles

| Role | Access Level | Capabilities |
|------|--------------|--------------|
| **SUPERADMIN** | Full system access | Can manage users, access all plants, perform all operations |
| **ADMIN** | Plant-specific | Can only access assigned plants, cannot manage users |

### Authentication Models

#### User
- **Table**: `users`
- **Fields**: `id`, `username`, `email`, `hashed_password`, `role`, `is_active`, `created_at`, `updated_at`
- **Relationships**: Many-to-many with Plant through PlantPermission

#### PlantPermission
- **Table**: `plant_permissions`
- **Fields**: `id`, `user_id`, `plant_id`, `created_at`
- **Purpose**: Maps ADMIN users to plants they can access
- **Constraint**: Unique on `(user_id, plant_id)`

### Default Credentials

```bash
Username: admin
Password: admin123
Role: SUPERADMIN
```

**⚠️ Change the default password after first login!**

### Protected Endpoints

All endpoints except `/auth/login` require authentication via JWT token:

```http
Authorization: Bearer <token>
```

### Permission Checks

- **Public**: `/auth/login` (no authentication)
- **Authenticated**: `/auth/me` and most endpoints (requires valid token)
- **SUPERADMIN Only**: `/users/*` endpoints (user management)
- **Plant-Based**: Some endpoints check plant access for ADMIN users

### Configuration

**Required in `.env` file:**

```env
SECRET_KEY=your-secure-random-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480
```

**⚠️ CRITICAL**: The `SECRET_KEY` must remain constant. If it changes, all tokens become invalid.

### Detailed Documentation

For comprehensive authentication documentation, see:
- **[AUTH_GUIDE.md](./AUTH_GUIDE.md)** - Complete authentication & authorization guide

Topics covered in AUTH_GUIDE.md:
- Authentication flow and JWT tokens
- Password management and bcrypt implementation
- All auth-related API endpoints
- Role-based access control in detail
- Frontend integration
- Security best practices
- Troubleshooting common auth issues

---

## Database Models & Relationships

### Entity Relationship Diagram

```
User (1) ──< (N) PlantPermission (N) >── (1) Plant
                                            │
Customer (1) ──< (N) TallySession (N) >────┤
                              │
                              │ (1)
                              │
                              ▼ (N)
                    AllocationDetails
                              │
                              │ (N) ──< (1) WeightClassification
                              │
                              │ (1)
                              ▼ (N)
                    TallyLogEntry
```

### Core Models

#### User
- **Fields**: `id`, `username`, `email`, `hashed_password`, `role`, `is_active`, `created_at`, `updated_at`
- **Enums**: `role` can be "superadmin" or "admin"
- **Constraints**: 
  - Unique on `username`
  - Unique on `email`
- **Relationships**: 
  - `plant_permissions` (one-to-many with PlantPermission)
  
#### PlantPermission
- **Fields**: `id`, `user_id`, `plant_id`, `created_at`
- **Constraints**: Unique on `(user_id, plant_id)`
- **Relationships**:
  - `user` (many-to-one with User)
  - `plant` (many-to-one with Plant)
  - Cascade: Deletes when user or plant is deleted

#### Customer
- **Fields**: `id`, `name`, `created_at`, `updated_at`
- **Relationships**: 
  - `tally_sessions` (one-to-many with TallySession)
  - Cascade: `all, delete-orphan` (ORM level only)

#### Plant
- **Fields**: `id`, `name`, `created_at`, `updated_at`
- **Relationships**:
  - `weight_classifications` (one-to-many with WeightClassification)
  - `tally_sessions` (one-to-many with TallySession)
  - Cascade: `all, delete-orphan` (ORM level only)

#### WeightClassification
- **Fields**: `id`, `plant_id`, `classification`, `description`, `min_weight`, `max_weight`, `category`, `created_at`, `updated_at`
- **Constraints**:
  - `category` must be "Dressed" or "Byproduct" (CHECK constraint)
  - Unique index on `(tally_session_id, weight_classification_id)` for AllocationDetails
- **Relationships**:
  - `plant` (many-to-one with Plant)
  - `allocation_details` (one-to-many with AllocationDetails)
  - Cascade: `all, delete-orphan` (ORM level only)

#### TallySession
- **Fields**: `id`, `customer_id`, `plant_id`, `date`, `status`, `created_at`, `updated_at`
- **Enums**: `status` can be "ongoing", "completed", or "cancelled"
- **Indexes**:
  - `idx_customer_plant_date` on `(customer_id, plant_id, date)`
  - `idx_status_date` on `(status, date)`
- **Relationships**:
  - `customer` (many-to-one with Customer)
  - `plant` (many-to-one with Plant)
  - `allocation_details` (one-to-many with AllocationDetails)
  - `tally_log_entries` (one-to-many with TallyLogEntry)
  - Cascade: `all, delete-orphan` for child relationships

#### AllocationDetails
- **Fields**: `id`, `tally_session_id`, `weight_classification_id`, `required_bags`, `allocated_bags_tally`, `allocated_bags_dispatcher`, `created_at`, `updated_at`
- **Constraints**:
  - Unique constraint on `(tally_session_id, weight_classification_id)`
- **Relationships**:
  - `tally_session` (many-to-one with TallySession)
  - `weight_classification` (many-to-one with WeightClassification)

#### TallyLogEntry
- **Fields**: `id`, `tally_session_id`, `weight_classification_id`, `role`, `weight`, `notes`, `created_at`
- **Enums**: `role` can be "tally" or "dispatcher"
- **Indexes**:
  - `idx_session_role` on `(tally_session_id, role)`
  - `idx_session_created` on `(tally_session_id, created_at)`
  - `idx_classification` on `(weight_classification_id)`
- **Relationships**:
  - `tally_session` (many-to-one with TallySession)
  - `weight_classification` (many-to-one with WeightClassification)

---

## Destructive Operation Guards

**⚠️ IMPORTANT**: The following operations have explicit guards to prevent accidental data loss. These guards take precedence over ORM cascade settings.

### Customer Deletion

**Location**: `app/crud/customer.py::delete_customer()`

**Guard**: Prevents deletion if customer has associated tally sessions.

```python
# Check if there are any tally sessions associated with this customer
associated_sessions = db.query(TallySession).filter(TallySession.customer_id == customer_id).count()
if associated_sessions > 0:
    raise ValueError(f"Cannot delete customer: {associated_sessions} tally session(s) are associated with this customer. Please delete or reassign the sessions first.")
```

**Error Response**: HTTP 400 Bad Request with error message

**Action Required**: Delete or reassign all associated tally sessions before deleting the customer.

---

### Plant Deletion

**Location**: `app/crud/plant.py::delete_plant()`

**Guards**: 
1. Prevents deletion if plant has associated tally sessions
2. Prevents deletion if plant has associated weight classifications

```python
# Check for tally sessions
associated_sessions = db.query(TallySession).filter(TallySession.plant_id == plant_id).count()
if associated_sessions > 0:
    raise ValueError(f"Cannot delete plant: {associated_sessions} tally session(s) are associated with this plant. Please delete or reassign the sessions first.")

# Check for weight classifications
associated_weight_classes = db.query(WeightClassification).filter(WeightClassification.plant_id == plant_id).count()
if associated_weight_classes > 0:
    raise ValueError(f"Cannot delete plant: {associated_weight_classes} weight classification(s) are associated with this plant. Please delete the weight classifications first.")
```

**Error Response**: HTTP 400 Bad Request with error message

**Action Required**: 
1. Delete or reassign all associated tally sessions
2. Delete all associated weight classifications

---

### Weight Classification Deletion

**Location**: `app/crud/weight_classification.py::delete_weight_classification()`

**Guard**: None - deletion is allowed, but note that:
- Associated `AllocationDetails` will be deleted via cascade (ORM level)
- This may affect existing tally sessions

**Note**: While there's no explicit guard, consider the impact on existing allocations before deletion.

---

### Tally Session Deletion

**Location**: `app/crud/tally_session.py::delete_tally_session()`

**Guard**: None - deletion is allowed, but note that:
- Associated `AllocationDetails` will be deleted via cascade
- Associated `TallyLogEntry` records will be deleted via cascade
- This is a destructive operation that removes all session data

---

### Allocation Details Deletion

**Location**: `app/crud/allocation_details.py::delete_allocation_detail()`

**Guard**: None, but **automatically deletes associated log entries**:

```python
# Delete associated log entries for this allocation's session and weight classification
deleted_count = db.query(TallyLogEntry).filter(
    TallyLogEntry.tally_session_id == db_allocation.tally_session_id,
    TallyLogEntry.weight_classification_id == db_allocation.weight_classification_id
).delete(synchronize_session=False)
```

**Important**: Deleting an allocation detail will delete all tally log entries for that session + weight classification combination.

---

### Allocation Details Update (Weight Classification Change)

**Location**: `app/crud/allocation_details.py::update_allocation_detail()`

**Guard**: Prevents changing `weight_classification_id` if log entries exist:

```python
if 'weight_classification_id' in update_data:
    new_wc_id = update_data['weight_classification_id']
    if new_wc_id != db_allocation.weight_classification_id:
        log_entry_count = db.query(TallyLogEntry).filter(
            TallyLogEntry.tally_session_id == db_allocation.tally_session_id,
            TallyLogEntry.weight_classification_id == db_allocation.weight_classification_id
        ).count()
        
        if log_entry_count > 0:
            raise ValueError(
                f"Cannot change weight classification because there are {log_entry_count} existing log entry/entries "
                "for this allocation. Please delete the log entries from the view logs screen first for safety."
            )
```

**Error Response**: HTTP 400 Bad Request with error message

**Action Required**: Delete all log entries for the allocation before changing the weight classification.

---

### Tally Log Entry Deletion

**Location**: `app/crud/tally_log_entry.py::delete_tally_log_entry()`

**Guard**: None, but **automatically decrements allocation counts**:

```python
# Decrement the appropriate allocated_bags field based on role
if log_entry.role == TallyLogEntryRole.TALLY:
    allocation.allocated_bags_tally = max(0.0, allocation.allocated_bags_tally - 1)
elif log_entry.role == TallyLogEntryRole.DISPATCHER:
    allocation.allocated_bags_dispatcher = max(0.0, allocation.allocated_bags_dispatcher - 1)
```

**Important**: Deleting a log entry automatically updates the corresponding allocation detail's bag count.

---

## Business Logic Rules

### Weight Classifications

#### Category Types
- **Dressed**: Weight-based classifications with min/max ranges
- **Byproduct**: Non-weight-based classifications (e.g., "Gizzards", "Hearts")

#### Dressed Category Rules
1. **No Overlapping Ranges**: Weight ranges cannot overlap for the same plant and category
2. **Range Types**:
   - Regular: `min_weight` and `max_weight` both set (e.g., 1.0-2.0)
   - "Up" range: `min_weight` set, `max_weight` null (e.g., 2.0 and up)
   - "Down" range: `min_weight` null, `max_weight` set (e.g., up to 1.0)
   - Catch-all: Both null (covers all weights)
3. **Overlap Detection**: Catch-all ranges overlap with everything

**Location**: `app/crud/weight_classification.py::_check_overlaps()`

#### Byproduct Category Rules
1. **No Duplicate Names**: Cannot have two byproducts with the same classification name for the same plant
2. **No Duplicate Descriptions**: Cannot have two byproducts with the same description for the same plant
3. **Description**: Optional but recommended for clarity

**Location**: `app/crud/weight_classification.py::_check_byproduct_duplicates()`

### Allocation Details

#### Unique Constraint
- One allocation detail per `(tally_session_id, weight_classification_id)` combination
- Enforced at database level via unique index

#### Allocated Bags Calculation
- **`allocated_bags_tally`**: Automatically calculated from count of TALLY role log entries
- **`allocated_bags_dispatcher`**: Automatically calculated from count of DISPATCHER role log entries
- **Not directly editable**: These fields are computed, not set directly

#### Automatic Creation
- When a tally log entry is created, if no allocation detail exists for that session + classification, one is automatically created

**Location**: `app/crud/tally_log_entry.py::create_tally_log_entry()`

### Tally Log Entries

#### Role-Based Counting
- Each log entry represents **one bag/item**
- `allocated_bags_tally` increments by 1 for each TALLY role entry
- `allocated_bags_dispatcher` increments by 1 for each DISPATCHER role entry

#### Atomic Operations
- Creating a log entry and updating allocation counts happens in a single transaction
- Deleting a log entry and decrementing allocation counts happens in a single transaction

### Reset Operations

#### Reset Tally Allocations
**Endpoint**: `POST /api/v1/tally-sessions/{session_id}/allocations/reset-tally`

**Behavior**:
- Deletes all TALLY role log entries for the session
- Recalculates `allocated_bags_tally` from remaining log entries (should be 0 after deletion)

**Location**: `app/crud/allocation_details.py::reset_allocated_bags_for_session()`

#### Reset Dispatcher Allocations
**Endpoint**: `POST /api/v1/tally-sessions/{session_id}/allocations/reset-dispatcher`

**Behavior**:
- Deletes all DISPATCHER role log entries for the session
- Recalculates `allocated_bags_dispatcher` from remaining log entries (should be 0 after deletion)

---

## API Structure

### Base URL
- Local: `http://localhost:8000`
- API Prefix: `/api/v1`

### Endpoints

#### Authentication
- `POST /api/v1/auth/login` - Login with username/password (returns JWT token)
- `GET /api/v1/auth/me` - Get current user info (🔒 requires authentication)

#### User Management (🔒 SUPERADMIN only)
- `GET /api/v1/users` - List all users
- `GET /api/v1/users/{user_id}` - Get user by ID
- `POST /api/v1/users` - Create new user
- `PUT /api/v1/users/{user_id}` - Update user
- `DELETE /api/v1/users/{user_id}` - Delete user

#### Customers (🔒 requires authentication)
- `GET /api/v1/customers` - List all customers
- `GET /api/v1/customers/{customer_id}` - Get customer by ID
- `POST /api/v1/customers` - Create customer
- `PUT /api/v1/customers/{customer_id}` - Update customer
- `DELETE /api/v1/customers/{customer_id}` - Delete customer (⚠️ guarded)

#### Plants (🔒 requires authentication)
- `GET /api/v1/plants` - List all plants
- `GET /api/v1/plants/{plant_id}` - Get plant by ID
- `POST /api/v1/plants` - Create plant
- `PUT /api/v1/plants/{plant_id}` - Update plant
- `DELETE /api/v1/plants/{plant_id}` - Delete plant (⚠️ guarded)

#### Weight Classifications (🔒 requires authentication)
- `GET /api/v1/plants/{plant_id}/weight-classifications` - List by plant
- `GET /api/v1/weight-classifications/{wc_id}` - Get by ID
- `POST /api/v1/plants/{plant_id}/weight-classifications` - Create (⚠️ validation)
- `PUT /api/v1/weight-classifications/{wc_id}` - Update (⚠️ validation)
- `DELETE /api/v1/weight-classifications/{wc_id}` - Delete

#### Tally Sessions (🔒 requires authentication)
- `GET /api/v1/tally-sessions` - List (supports `customer_id`, `plant_id`, `status` filters)
- `GET /api/v1/tally-sessions/{session_id}` - Get by ID
- `POST /api/v1/tally-sessions` - Create (⚠️ validates customer/plant exist)
- `PUT /api/v1/tally-sessions/{session_id}` - Update (⚠️ validates customer/plant exist)
- `DELETE /api/v1/tally-sessions/{session_id}` - Delete

#### Allocation Details (🔒 requires authentication)
- `GET /api/v1/tally-sessions/{session_id}/allocations` - List by session
- `GET /api/v1/allocations/{allocation_id}` - Get by ID
- `POST /api/v1/tally-sessions/{session_id}/allocations` - Create (⚠️ validates uniqueness)
- `PUT /api/v1/allocations/{allocation_id}` - Update (⚠️ guarded for weight_classification_id change)
- `DELETE /api/v1/allocations/{allocation_id}` - Delete (⚠️ deletes associated log entries)
- `POST /api/v1/tally-sessions/{session_id}/allocations/reset-tally` - Reset tally allocations
- `POST /api/v1/tally-sessions/{session_id}/allocations/reset-dispatcher` - Reset dispatcher allocations

#### Tally Log Entries (🔒 requires authentication)
- `GET /api/v1/tally-sessions/{session_id}/log-entries` - List by session (supports `role` filter)
- `GET /api/v1/log-entries/{entry_id}` - Get by ID
- `POST /api/v1/tally-sessions/{session_id}/log-entries` - Create (⚠️ auto-creates allocation, increments counts)
- `DELETE /api/v1/log-entries/{entry_id}` - Delete (⚠️ decrements allocation counts)

### Health Checks (public)
- `GET /` - API info
- `GET /health` - Basic health check
- `GET /health/db` - Database connection health check

**Legend:**
- 🔒 = Requires authentication (JWT token)
- 🔒 SUPERADMIN only = Requires SUPERADMIN role

---

## Important Implementation Details

### Database Connection

**Location**: `app/database.py`

- **SQLite**: Uses `check_same_thread=False` for connection args
- **Azure SQL**: Uses connection pooling with `pool_pre_ping=True` and `pool_recycle=3600`
- Session management via dependency injection (`get_db()`)

### Error Handling

**Location**: `app/main.py`

- **Global Exception Handler**: Catches all unhandled exceptions
- **SQLAlchemy Error Handler**: Handles database errors
- **Validation Error Handler**: Handles Pydantic validation errors
- **Debug Mode**: Full tracebacks in debug mode, sanitized in production

### CORS Configuration

**Location**: `app/main.py` and `app/config.py`

- Configurable via `CORS_ORIGINS` environment variable
- Default: `*` (allow all origins)
- Can be comma-separated list: `"http://localhost:3000,https://example.com"`

### SQL Server Compatibility

- **ORDER BY Required**: SQL Server requires `ORDER BY` when using `OFFSET`/`LIMIT`
- All list queries include explicit ordering
- Example: `db.query(Customer).order_by(Customer.id).offset(skip).limit(limit).all()`

### Timestamps

- All models use UTC timestamps via `utcnow()` helper
- `created_at`: Set on creation
- `updated_at`: Auto-updated on modification via `onupdate=utcnow`

### Cascade Behavior

**Important Note**: While models define `cascade="all, delete-orphan"` at the ORM level, **application-level guards take precedence**. The cascade settings would only apply if the guards allowed the deletion to proceed.

**Actual Behavior**:
- Customer deletion: **Blocked** if tally sessions exist (guard)
- Plant deletion: **Blocked** if tally sessions or weight classifications exist (guard)
- Tally session deletion: **Allowed** (cascades to allocations and log entries)
- Weight classification deletion: **Allowed** (cascades to allocations)
- Allocation deletion: **Allowed** (manually deletes log entries)

---

## Configuration

### Environment Variables

**Location**: `app/config.py`

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite:///./tally_system.db` | Database connection string |
| `API_V1_PREFIX` | `/api/v1` | API version prefix |
| `DEBUG` | `True` | Enable debug mode |
| `CORS_ORIGINS` | `*` | CORS allowed origins (comma-separated) |
| `SECRET_KEY` | *(required)* | JWT token signing key (must be set in .env) |
| `ALGORITHM` | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `480` | Token expiration time (8 hours) |

### Database URLs

**SQLite**:
```
sqlite:///./tally_system.db
```

**Azure SQL Database**:
```
mssql+pyodbc://username:password@server.database.windows.net/database?driver=ODBC+Driver+18+for+SQL+Server&Encrypt=yes&TrustServerCertificate=no
```

### Settings Loading

- Settings are loaded from `.env` file (if present)
- Environment variables override `.env` values
- Case-insensitive matching

---

## Summary of Guards

| Operation | Guard Type | Error Code | Action Required |
|-----------|------------|------------|-----------------|
| Delete Customer | Check for tally sessions | 400 | Delete/reassign sessions first |
| Delete Plant | Check for tally sessions + weight classifications | 400 | Delete/reassign sessions, delete weight classifications |
| Update Allocation (change weight_classification_id) | Check for log entries | 400 | Delete log entries first |
| Create Weight Classification | Check for overlaps/duplicates | 400 | Fix range/name conflicts |
| Update Weight Classification | Check for overlaps/duplicates | 400 | Fix range/name conflicts |
| Create Allocation Detail | Check for uniqueness | 400 | One allocation per session+classification |
| Create Tally Log Entry | Auto-creates allocation | N/A | Automatic |
| Delete Allocation Detail | Auto-deletes log entries | N/A | Automatic |
| Delete Tally Log Entry | Auto-decrements counts | N/A | Automatic |

---

## Development Notes

1. **Always check guards before implementing deletion features** in frontend/mobile apps
2. **Allocation bag counts are computed**, not directly editable
3. **Log entries drive allocation counts** - deleting entries affects counts
4. **Weight classification changes require log entry cleanup** first
5. **Cascade settings in models are informational** - guards control actual behavior
6. **SQL Server requires ORDER BY** for paginated queries
7. **All timestamps are UTC** - handle timezone conversion in frontend
8. **SECRET_KEY must be fixed in .env** - changing it invalidates all tokens
9. **JWT sub claim must be a string** - use `str(user.id)` when creating tokens
10. **SUPERADMIN can access all plants** - ADMIN users need explicit PlantPermission records

---

## Migration Notes

- Alembic is used for database migrations
- Migration files are in `alembic/versions/`
- Run migrations with: `alembic upgrade head`
- Create new migration: `alembic revision --autogenerate -m "description"`
- Authentication tables added in migration `009_add_authentication_tables`

## Seeding Data

### Create Default Superadmin

```bash
cd backend
python seed_admin.py
```

Creates default superadmin user:
- Username: `admin`
- Password: `admin123`
- Email: `admin@tallysystem.local`
- Role: `SUPERADMIN`

**⚠️ Change the default password after first login!**

---

## Related Documentation

- **[AUTH_GUIDE.md](./AUTH_GUIDE.md)** - Comprehensive authentication and authorization guide
- **[INSTALL.md](./INSTALL.md)** - Installation and setup instructions
- **[AZURE_SQL_SETUP.md](./AZURE_SQL_SETUP.md)** - Azure SQL Database configuration

---

*Last Updated: Based on codebase analysis*
*For questions or updates, refer to the codebase or update this document accordingly.*

