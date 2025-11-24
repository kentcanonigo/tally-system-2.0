# Authentication & Authorization Guide

This document provides comprehensive information about the authentication and authorization system for the Tally System admin dashboard.

## Table of Contents

1. [Overview](#overview)
2. [Authentication Models](#authentication-models)
3. [JWT Token Flow](#jwt-token-flow)
4. [Password Management](#password-management)
5. [API Endpoints](#api-endpoints)
6. [Role-Based Access Control](#role-based-access-control)
7. [Frontend Integration](#frontend-integration)
8. [Configuration](#configuration)
9. [Security Best Practices](#security-best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The Tally System uses **JWT (JSON Web Token) authentication** with **role-based access control (RBAC)** to secure the admin dashboard.

**Key Features:**
- JWT-based stateless authentication
- Two user roles: SUPERADMIN and ADMIN
- Plant-based permissions for ADMIN users
- Bcrypt password hashing
- Token expiration (8 hours default)
- Protected API endpoints

**Tech Stack:**
- `bcrypt` - Password hashing
- `python-jose[cryptography]` - JWT token handling
- `python-multipart` - Form data handling
- `email-validator` - Email validation
- `pydantic[email]` - Email field validation

---

## Authentication Models

### User Model

**Location**: `app/models/user.py`

```python
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(255), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.ADMIN)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)
```

**Fields:**
- `username`: Unique username (3-255 characters)
- `email`: Unique email address (validated)
- `hashed_password`: Bcrypt-hashed password
- `role`: User role (SUPERADMIN or ADMIN)
- `is_active`: Account status flag
- `created_at`: Account creation timestamp
- `updated_at`: Last modification timestamp

### UserRole Enum

```python
class UserRole(str, Enum):
    SUPERADMIN = "superadmin"  # Full system access
    ADMIN = "admin"             # Limited access based on plant permissions
```

### PlantPermission Model

**Location**: `app/models/plant_permission.py`

```python
class PlantPermission(Base):
    __tablename__ = "plant_permissions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    plant_id = Column(Integer, ForeignKey("plants.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
```

**Purpose**: Maps ADMIN users to specific plants they can access.

**Constraint**: Unique constraint on `(user_id, plant_id)` - one permission per user-plant pair.

---

## JWT Token Flow

### Token Creation

**Location**: `app/auth/jwt.py::create_access_token()`

```python
def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    
    return encoded_jwt
```

**Token Payload:**
```json
{
  "sub": "1",              // User ID (as string, per JWT spec)
  "username": "admin",     // Username
  "role": "superadmin",    // User role
  "exp": 1763989740        // Expiration timestamp
}
```

**Important**: The `sub` claim MUST be a string per JWT specification!

### Token Validation

**Location**: `app/auth/jwt.py::decode_access_token()`

```python
def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        return payload
    except JWTError:
        return None  # Invalid token
```

### Authentication Flow

```
1. User submits username + password
   ↓
2. Backend validates credentials
   ↓
3. Backend creates JWT token with user data
   ↓
4. Frontend stores token in localStorage
   ↓
5. Frontend includes token in Authorization header for all requests
   ↓
6. Backend validates token on each request
   ↓
7. Backend extracts user from token and checks permissions
```

---

## Password Management

### Password Hashing

**Location**: `app/auth/password.py`

Uses `bcrypt` directly (not passlib) to avoid compatibility issues with newer bcrypt versions.

```python
def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')  # Store as string in database
```

### Password Verification

```python
def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    password_bytes = plain_password.encode('utf-8')
    hashed_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password_bytes, hashed_bytes)
```

**Password Requirements:**
- Minimum 6 characters (enforced in schema)
- Maximum 72 bytes (bcrypt limitation)
- No other requirements enforced by default

---

## API Endpoints

### Public Endpoints (No Authentication Required)

#### Login
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

**Response (401 Unauthorized):**
```json
{
  "detail": "Incorrect username or password"
}
```

### Protected Endpoints (Authentication Required)

All protected endpoints require the `Authorization` header:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Get Current User
```http
GET /api/v1/auth/me
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "id": 1,
  "username": "admin",
  "email": "admin@tallysystem.local",
  "role": "superadmin",
  "is_active": true,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z",
  "plant_ids": [1, 2, 3]
}
```

### User Management Endpoints (SUPERADMIN Only)

#### List Users
```http
GET /api/v1/users
Authorization: Bearer <superadmin_token>
```

#### Create User
```http
POST /api/v1/users
Authorization: Bearer <superadmin_token>
Content-Type: application/json

{
  "username": "newadmin",
  "email": "newadmin@example.com",
  "password": "secure123",
  "role": "admin",
  "plant_ids": [1, 2]
}
```

#### Update User
```http
PUT /api/v1/users/{user_id}
Authorization: Bearer <superadmin_token>
Content-Type: application/json

{
  "email": "newemail@example.com",
  "is_active": false,
  "plant_ids": [1]
}
```

#### Delete User
```http
DELETE /api/v1/users/{user_id}
Authorization: Bearer <superadmin_token>
```

---

## Role-Based Access Control

### User Roles

#### SUPERADMIN
- **Full system access**
- Can access all plants
- Can manage users (create, update, delete)
- Can perform all operations
- Default credentials: `admin` / `admin123`

#### ADMIN
- **Limited access based on plant permissions**
- Can only access assigned plants
- Cannot manage users
- Can perform tally operations for assigned plants

### Permission Checks

**Location**: `app/auth/dependencies.py`

#### Require Authentication
```python
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    # Validates JWT token
    # Returns User object
    # Raises 401 if invalid
```

#### Require SUPERADMIN
```python
async def require_superadmin(
    current_user: User = Depends(get_current_user)
) -> User:
    if current_user.role != UserRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Superadmin access required")
    return current_user
```

#### Check Plant Access
```python
def check_plant_access(plant_id: int):
    """Returns a dependency that checks if user has access to a specific plant."""
    async def _check_access(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
    ) -> User:
        # Superadmins have access to all plants
        if current_user.role == UserRole.SUPERADMIN:
            return current_user
        
        # Check if admin has permission
        permission = db.query(PlantPermission).filter(
            PlantPermission.user_id == current_user.id,
            PlantPermission.plant_id == plant_id
        ).first()
        
        if not permission:
            raise HTTPException(status_code=403, detail="No access to this plant")
        
        return current_user
    
    return _check_access
```

### Usage in Routes

```python
# Public endpoint
@router.post("/login")
async def login(login_data: UserLogin, db: Session = Depends(get_db)):
    # No authentication required
    pass

# Protected endpoint (any authenticated user)
@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    # Requires authentication
    pass

# SUPERADMIN only endpoint
@router.get("/users")
async def list_users(
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    # Requires SUPERADMIN role
    pass

# Plant-specific endpoint
@router.get("/plants/{plant_id}/data")
async def get_plant_data(
    plant_id: int,
    current_user: User = Depends(check_plant_access(plant_id)),
    db: Session = Depends(get_db)
):
    # Requires access to specific plant
    pass
```

---

## Frontend Integration

### Authentication Service

**Location**: `web/src/services/auth.ts`

```typescript
// Store token in localStorage
export const setToken = (token: string): void => {
  localStorage.setItem('tally_system_token', token);
};

// Get token from localStorage
export const getToken = (): string | null => {
  return localStorage.getItem('tally_system_token');
};

// Remove token
export const removeToken = (): void => {
  localStorage.removeItem('tally_system_token');
};

// Login
export const login = async (credentials: LoginRequest): Promise<AuthResponse> => {
  const response = await axios.post(`${API_BASE_URL}/auth/login`, credentials);
  setToken(response.data.access_token);
  return response.data;
};

// Get current user
export const getCurrentUser = async (): Promise<User> => {
  const token = getToken();
  if (!token) throw new Error('No authentication token found');
  
  const response = await axios.get(`${API_BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  return response.data;
};
```

### Axios Interceptors

**Location**: `web/src/services/api.ts`

```typescript
// Add token to all requests
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors (invalid/expired token)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      removeToken();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### Auth Context

**Location**: `web/src/contexts/AuthContext.tsx`

Provides authentication state and methods to the entire React app:

```typescript
const { user, loading, login, logout, isAuthenticated, isSuperadmin } = useAuth();

// Check if user is authenticated
if (!isAuthenticated) {
  return <Navigate to="/login" />;
}

// Check if user is superadmin
if (!isSuperadmin) {
  return <Navigate to="/dashboard" />;
}
```

---

## Configuration

### Environment Variables

**Location**: `backend/.env`

**Required Configuration:**

```env
# JWT Authentication
SECRET_KEY=your-secret-key-here-change-this-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480
```

**Generate a secure SECRET_KEY:**

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

**⚠️ CRITICAL**: The `SECRET_KEY` must remain constant across server restarts. If it changes, all existing tokens become invalid and users must log in again.

### Default Superadmin

**Location**: `backend/seed_admin.py`

Default credentials:
- **Username**: `admin`
- **Password**: `admin123`
- **Email**: `admin@tallysystem.local`
- **Role**: `SUPERADMIN`

**Create/Reset Admin:**

```bash
cd backend
python seed_admin.py
```

⚠️ **Change the default password immediately after first login!**

---

## Security Best Practices

### 1. SECRET_KEY Management

- ✅ Use a strong, random SECRET_KEY
- ✅ Store SECRET_KEY in `.env` file (never commit to git)
- ✅ Use different SECRET_KEY for each environment (dev/staging/prod)
- ❌ Never hardcode SECRET_KEY in source code
- ❌ Never share SECRET_KEY publicly

### 2. Password Security

- ✅ Passwords are hashed with bcrypt (strong algorithm)
- ✅ Salt is automatically generated per password
- ✅ Minimum 6 characters enforced
- ⚠️ Consider enforcing stronger password requirements (complexity, length)

### 3. Token Security

- ✅ Tokens expire after 8 hours (configurable)
- ✅ Tokens are signed and verified
- ✅ Tokens stored in localStorage (frontend)
- ⚠️ Consider using httpOnly cookies for extra security
- ⚠️ Consider refresh token mechanism for better UX

### 4. HTTPS

- ✅ Use HTTPS in production
- ❌ Never send tokens over HTTP
- ✅ Set secure cookie flags if using cookies

### 5. Account Management

- ✅ Inactive accounts can be disabled (`is_active` flag)
- ✅ User credentials are validated on every login
- ⚠️ Consider implementing account lockout after failed attempts
- ⚠️ Consider implementing password reset functionality

---

## Troubleshooting

### Problem: Login succeeds but subsequent requests get 401

**Symptoms:**
- `POST /auth/login` returns 200 OK with token
- `GET /auth/me` returns 401 Unauthorized

**Cause**: SECRET_KEY is changing between requests (regenerated on server restart)

**Solution:**
1. Create `.env` file with fixed SECRET_KEY
2. Ensure `.env` is loaded properly
3. Restart server
4. Clear browser localStorage and log in again

### Problem: "Subject must be a string" error

**Symptoms:**
- JWT decode error: `JWTClaimsError: Subject must be a string`

**Cause**: Passing integer user ID as `sub` claim instead of string

**Solution:**
- Use `str(user.id)` when creating token
- Parse back to `int(payload.get("sub"))` when decoding

### Problem: Bcrypt version warning

**Symptoms:**
```
WARNING - (trapped) error reading bcrypt version
AttributeError: module 'bcrypt' has no attribute '__about__'
```

**Cause**: Incompatibility between passlib and newer bcrypt versions

**Solution:**
- Use bcrypt directly instead of passlib
- See `app/auth/password.py` for implementation

### Problem: Email validation error

**Symptoms:**
```
ImportError: email-validator is not installed
```

**Cause**: Missing `email-validator` package

**Solution:**
```bash
pip install email-validator
```

### Problem: Token won't validate after server restart

**Cause**: SECRET_KEY was regenerated on restart

**Solution:**
- Ensure SECRET_KEY is set in `.env` file
- Do not generate SECRET_KEY at runtime

### Problem: User has plant_ids but can't access plant

**Cause**: Plant permissions not properly created

**Solution:**
```python
# Check if permissions exist
permissions = db.query(PlantPermission).filter(
    PlantPermission.user_id == user_id
).all()

# Create permissions if missing
for plant_id in plant_ids:
    permission = PlantPermission(user_id=user_id, plant_id=plant_id)
    db.add(permission)
db.commit()
```

---

## Database Schema

### Migration: 009_add_authentication_tables

**Location**: `backend/alembic/versions/009_add_authentication_tables.py`

Creates:
- `users` table
- `plant_permissions` table
- Indexes and constraints

**Run migration:**
```bash
cd backend
alembic upgrade head
```

---

## Testing Authentication

### Manual Testing with cURL

**Login:**
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

**Get Current User:**
```bash
curl -X GET http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer <your_token_here>"
```

### Testing with Python

```python
import requests

# Login
response = requests.post('http://localhost:8000/api/v1/auth/login', 
    json={'username': 'admin', 'password': 'admin123'})
token = response.json()['access_token']

# Get user info
response = requests.get('http://localhost:8000/api/v1/auth/me',
    headers={'Authorization': f'Bearer {token}'})
print(response.json())
```

---

## Summary

- **Authentication**: JWT token-based, stateless
- **Password Hashing**: Bcrypt (strong, industry-standard)
- **Roles**: SUPERADMIN (full access), ADMIN (plant-based access)
- **Token Lifetime**: 8 hours (configurable)
- **Security**: SECRET_KEY must be fixed and secure
- **Frontend**: Token stored in localStorage, added to all requests
- **Permissions**: Plant-based access control for ADMIN users

**Key Files:**
- `app/models/user.py` - User model
- `app/auth/jwt.py` - JWT token handling
- `app/auth/password.py` - Password hashing
- `app/auth/dependencies.py` - Auth dependencies
- `app/api/routes/auth.py` - Auth endpoints
- `seed_admin.py` - Create default admin
- `.env` - Configuration (SECRET_KEY)

---

*Last Updated: Based on current implementation*
*For questions or updates, refer to the codebase or update this document accordingly.*

