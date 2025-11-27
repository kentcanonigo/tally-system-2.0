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

The Tally System uses **JWT (JSON Web Token) authentication** with a comprehensive **Role-Based Access Control (RBAC)** system to secure the admin dashboard and mobile application.

**Key Features:**
- JWT-based stateless authentication
- **RBAC System**: Flexible role and permission management
  - System roles: SUPERADMIN (full access) and ADMIN (most permissions)
  - Custom roles: Create roles with specific permission sets
  - Multiple roles per user: Users can have multiple roles, inheriting all permissions
  - Granular permissions: Fine-grained control over what users can do
- **Dual Access Control**:
  - Role-based permissions: Control **what** users can do (features)
  - Plant permissions: Control **where** users can operate (data scope)
- Bcrypt password hashing
- Token expiration (8 hours default)
- Protected API endpoints with permission checks

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
    role = Column(Enum(UserRole), nullable=True)  # DEPRECATED: Kept for backward compatibility
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)
    
    # User preferences
    timezone = Column(String(100), nullable=True, default='UTC')
    active_plant_id = Column(Integer, nullable=True)
    acceptable_difference_threshold = Column(Integer, nullable=False, default=0)
    visible_tabs = Column(JSON, nullable=True, default=None)
    
    # Relationships
    plant_permissions = relationship("PlantPermission", back_populates="user", cascade="all, delete-orphan")
    roles = relationship("Role", secondary="user_roles", back_populates="users")
```

**Fields:**
- `username`: Unique username (3-255 characters)
- `email`: Unique email address (validated)
- `hashed_password`: Bcrypt-hashed password
- `role`: **DEPRECATED** - Legacy role field, kept for backward compatibility only. Use RBAC roles instead.
- `is_active`: Account status flag
- `created_at`: Account creation timestamp
- `updated_at`: Last modification timestamp
- `timezone`: User's preferred timezone
- `active_plant_id`: User's currently active plant
- `acceptable_difference_threshold`: User's threshold for weight differences
- `visible_tabs`: JSON array of visible tab names

**Relationships:**
- `roles`: Many-to-many relationship with Role model (RBAC system)
- `plant_permissions`: One-to-many relationship with PlantPermission (data scope)

### RBAC Models

The system uses a comprehensive Role-Based Access Control (RBAC) system with the following models:

#### Role Model

**Location**: `app/models/role.py`

```python
class Role(Base):
    __tablename__ = "roles"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    is_system = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)
    
    # Relationships
    permissions = relationship("Permission", secondary="role_permissions", back_populates="roles")
    users = relationship("User", secondary="user_roles", back_populates="roles")
```

**Fields:**
- `name`: Unique role name (e.g., "SUPERADMIN", "ADMIN", "Tally Operator")
- `description`: Optional description of the role
- `is_system`: If `True`, role is a system role and cannot be edited/deleted
- `created_at`: Role creation timestamp
- `updated_at`: Last modification timestamp

**System Roles:**
- `SUPERADMIN`: Full system access, bypasses all permission checks
- `ADMIN`: Limited access with most permissions (cannot assign admin roles or view all plants)

#### Permission Model

**Location**: `app/models/permission.py`

```python
class Permission(Base):
    __tablename__ = "permissions"
    
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(50), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    
    # Relationships
    roles = relationship("Role", secondary="role_permissions", back_populates="permissions")
```

**Fields:**
- `code`: Unique permission code (e.g., "can_tally", "can_manage_users")
- `name`: Human-readable permission name
- `description`: Optional description of what the permission allows
- `category`: Permission category (e.g., "tally", "user_management", "role_management")
- `created_at`: Permission creation timestamp

**Permission Categories:**
- `tally`: Tally operations (start, view, edit, complete, cancel, delete)
- `management`: Data management (weight classes, customers)
- `user_management`: User account administration
- `role_management`: RBAC system administration
- `plant_management`: Plant/facility administration
- `reporting`: Data export and reporting

See `PERMISSIONS_GUIDE.md` for a complete list of available permissions.

#### UserRole Model

**Location**: `app/models/user_role.py`

```python
class UserRole(Base):
    __tablename__ = "user_roles"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    
    __table_args__ = (
        UniqueConstraint('user_id', 'role_id', name='unique_user_role'),
    )
```

**Purpose**: Maps users to roles (many-to-many relationship). Users can have multiple roles, inheriting all permissions from all assigned roles.

**Constraint**: Unique constraint on `(user_id, role_id)` - one assignment per user-role pair.

#### RolePermission Model

**Location**: `app/models/role_permission.py`

```python
class RolePermission(Base):
    __tablename__ = "role_permissions"
    
    id = Column(Integer, primary_key=True, index=True)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), nullable=False, index=True)
    permission_id = Column(Integer, ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    
    __table_args__ = (
        UniqueConstraint('role_id', 'permission_id', name='unique_role_permission'),
    )
```

**Purpose**: Maps permissions to roles (many-to-many relationship). Defines what permissions each role has.

**Constraint**: Unique constraint on `(role_id, permission_id)` - one assignment per role-permission pair.

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

**Purpose**: Maps users to specific plants they can access (data scope). Works in conjunction with RBAC permissions to control both **what** users can do and **where** they can do it.

**Constraint**: Unique constraint on `(user_id, plant_id)` - one permission per user-plant pair.

**Note**: Users with the SUPERADMIN role automatically have access to all plants and bypass plant permission checks.

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
  "role": "superadmin",    // Legacy role field (deprecated, kept for backward compatibility)
  "exp": 1763989740        // Expiration timestamp
}
```

**Important Notes:**
- The `sub` claim MUST be a string per JWT specification!
- The `role` field in the token is **deprecated** and kept only for backward compatibility
- Actual authorization is performed using the RBAC system (roles and permissions from database)
- The token does not include permissions or role_ids - these are fetched from the database on each request

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
  "plant_ids": [1, 2, 3],
  "role_ids": [1],
  "permissions": [
    "can_tally",
    "can_view_tally_logs",
    "can_manage_weight_classes",
    "can_manage_customers",
    "can_manage_users",
    ...
  ],
  "timezone": "UTC",
  "active_plant_id": 1,
  "acceptable_difference_threshold": 0,
  "visible_tabs": null
}
```

**Note**: The `role` field is deprecated but included for backward compatibility. Use `role_ids` and `permissions` for RBAC authorization.

### RBAC Endpoints

#### List Roles
```http
GET /api/v1/roles
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "name": "SUPERADMIN",
    "description": "Full system access",
    "is_system": true,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  },
  {
    "id": 2,
    "name": "ADMIN",
    "description": "Administrative access",
    "is_system": true,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
]
```

#### Get Role with Permissions
```http
GET /api/v1/roles/{role_id}
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "id": 2,
  "name": "ADMIN",
  "description": "Administrative access",
  "is_system": true,
  "permissions": [
    {
      "id": 1,
      "code": "can_tally",
      "name": "Can Tally",
      "description": "Add entries to tally logs (create and delete log entries)",
      "category": "tally"
    },
    ...
  ]
}
```

#### Create Role
```http
POST /api/v1/roles
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Tally Operator",
  "description": "Can start and view tallies"
}
```

**Requires**: `can_manage_roles` permission

#### Update Role
```http
PUT /api/v1/roles/{role_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Role Name",
  "description": "Updated description"
}
```

**Requires**: `can_manage_roles` permission  
**Note**: System roles (is_system=true) cannot be edited

#### Delete Role
```http
DELETE /api/v1/roles/{role_id}
Authorization: Bearer <token>
```

**Requires**: `can_delete_roles` permission  
**Note**: System roles cannot be deleted. Roles with assigned users cannot be deleted.

#### Assign Permissions to Role
```http
POST /api/v1/roles/{role_id}/permissions
Authorization: Bearer <token>
Content-Type: application/json

{
  "permission_ids": [1, 2, 3]
}
```

**Requires**: `can_assign_permissions` permission

#### Remove Permission from Role
```http
DELETE /api/v1/roles/{role_id}/permissions/{permission_id}
Authorization: Bearer <token>
```

**Requires**: `can_assign_permissions` permission

#### List Permissions
```http
GET /api/v1/permissions
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "code": "can_start_tally",
    "name": "Can Start Tally",
    "description": "Create new tally sessions",
    "category": "tally"
  },
  ...
]
```

### User Management Endpoints

#### List Users
```http
GET /api/v1/users
Authorization: Bearer <token>
```

**Requires**: `can_manage_users` OR `can_assign_admin_roles` permission

#### Create User
```http
POST /api/v1/users
Authorization: Bearer <token>
Content-Type: application/json

{
  "username": "newuser",
  "email": "newuser@example.com",
  "password": "secure123",
  "role": "admin",
  "plant_ids": [1, 2],
  "role_ids": [2, 3]
}
```

**Requires**: `can_manage_users` OR `can_assign_admin_roles` permission  
**Note**: 
- `role` field is deprecated but accepted for backward compatibility
- `role_ids` is the preferred way to assign roles (RBAC system)
- Assigning ADMIN or SUPERADMIN roles requires `can_assign_admin_roles` permission

#### Update User
```http
PUT /api/v1/users/{user_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "newemail@example.com",
  "is_active": false,
  "plant_ids": [1],
  "role_ids": [2]
}
```

**Requires**: `can_manage_users` OR `can_assign_admin_roles` permission  
**Note**: Updating `role_ids` to include ADMIN/SUPERADMIN requires `can_assign_admin_roles` permission

#### Delete User
```http
DELETE /api/v1/users/{user_id}
Authorization: Bearer <token>
```

**Requires**: `can_delete_users` permission

---

## Role-Based Access Control (RBAC)

The Tally System uses a comprehensive **Role-Based Access Control (RBAC)** system that provides granular permission management and flexible role assignments.

### Dual Access Control System

The system implements two complementary authorization layers:

1. **Role-Based Permissions** (Feature Access) - Controls **WHAT** users can do
   - Managed via `roles`, `permissions`, `role_permissions`, and `user_roles` tables
   - Users can have multiple roles, inheriting all permissions from all assigned roles
   - Examples: `can_start_tally`, `can_manage_customers`, `can_manage_users`

2. **Plant Permissions** (Data Scope) - Controls **WHERE** users can operate
   - Managed via `plant_permissions` table
   - Users with SUPERADMIN role automatically access all plants
   - Regular users need explicit plant access assignments

**Combined Authorization**: To perform an action on a plant, a user must:
- Have the required **permission** (via their assigned role(s))
- **AND** have access to that specific **plant** (via plant_permissions)
- **Exception**: Users with SUPERADMIN role bypass both checks automatically

### System Roles

#### SUPERADMIN
- **Full system access** - bypasses all permission checks
- Has access to **all plants** automatically
- Cannot be edited or deleted (`is_system=true`)
- Default credentials: `admin` / `admin123`

#### ADMIN
- **Most permissions** - has all permissions except:
  - ❌ `can_view_all_plants` - Can only view assigned plants
  - ❌ `can_assign_admin_roles` - Cannot elevate users to admin status
- Can only access **assigned plants**
- Cannot be edited or deleted (`is_system=true`)

### Custom Roles

SUPERADMIN and ADMIN users can create custom roles with specific permission sets. Custom roles:
- Can be edited and deleted (if no users are assigned)
- Can have any combination of permissions
- Can be assigned to multiple users
- Cannot be system roles

**Example Custom Roles:**
- **Tally Operator**: `can_tally`, `can_view_tally_logs`
- **Inventory Manager**: `can_manage_weight_classes`, `can_complete_tally`, `can_export_data`
- **HR Manager**: `can_manage_users`, `can_assign_basic_roles`, `can_delete_users`

See `PERMISSIONS_GUIDE.md` for a complete list of available permissions and example role configurations.

### Permission Checks

**Location**: `app/auth/dependencies.py`

#### Require Authentication
```python
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Validates JWT token and returns User object.
    Raises 401 if token is invalid or user not found.
    """
    # Validates JWT token
    # Returns User object with roles relationship loaded
    # Raises 401 if invalid
```

#### Require SUPERADMIN Role
```python
async def require_superadmin(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Ensures the current user has the SUPERADMIN role.
    Uses RBAC role system to check role name.
    """
    if not user_has_role(current_user, 'SUPERADMIN'):
        raise HTTPException(status_code=403, detail="Superadmin access required")
    return current_user
```

#### Check Permission
```python
def require_permission(permission_code: str):
    """
    Factory function that returns a dependency to check for a specific permission.
    Users with SUPERADMIN role bypass all permission checks.
    
    Args:
        permission_code: The permission code to check (e.g., "can_tally")
    
    Returns:
        Dependency function that checks if user has the permission
    """
    async def _check_permission(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
    ) -> User:
        # Users with SUPERADMIN role have all permissions
        if user_has_role(current_user, 'SUPERADMIN'):
            return current_user
        
        # Get user's permissions from their roles
        user_permissions = user_crud.get_user_permissions(db, current_user.id)
        
        if permission_code not in user_permissions:
            raise HTTPException(
                status_code=403,
                detail=f"Permission '{permission_code}' required"
            )
        
        return current_user
    
    return _check_permission
```

#### Check Any Permission
```python
def require_any_permission(permission_codes: List[str]):
    """
    Factory function that returns a dependency to check for any of the specified permissions.
    User must have at least one of the permissions.
    """
    # Similar to require_permission but checks if user has ANY of the permissions
```

#### Check Plant Access
```python
def check_plant_access(plant_id: int):
    """
    Factory function that returns a dependency to check if user has access to a specific plant.
    Users with SUPERADMIN role have access to all plants.
    """
    async def _check_access(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
    ) -> User:
        # Users with SUPERADMIN role have access to everything
        if user_has_role(current_user, 'SUPERADMIN'):
            return current_user
        
        # Check if user has explicit permission for this plant
        permission = db.query(PlantPermission).filter(
            PlantPermission.user_id == current_user.id,
            PlantPermission.plant_id == plant_id
        ).first()
        
        if not permission:
            raise HTTPException(
                status_code=403,
                detail="You don't have access to this plant"
            )
        
        return current_user
    
    return _check_access
```

#### Check Permission AND Plant Access
```python
def require_permission_and_plant_access(permission_code: str, plant_id: int):
    """
    Factory function that returns a dependency to check both permission and plant access.
    User needs the specified permission AND access to the specified plant.
    Users with SUPERADMIN role bypass both checks.
    """
    # Checks both permission and plant access
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

# Permission-protected endpoint
@router.post("/tally-sessions")
async def create_tally_session(
    session_data: TallySessionCreate,
    current_user: User = Depends(require_permission("can_create_tally_sessions")),
    db: Session = Depends(get_db)
):
    # Requires 'can_create_tally_sessions' permission
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

# Combined permission and plant access
@router.post("/plants/{plant_id}/tally-sessions")
async def create_plant_tally(
    plant_id: int,
    session_data: TallySessionCreate,
    current_user: User = Depends(
        require_permission_and_plant_access("can_create_tally_sessions", plant_id)
    ),
    db: Session = Depends(get_db)
):
    # Requires 'can_create_tally_sessions' permission AND access to the plant
    pass
```

### Getting User Permissions

To get a user's aggregated permissions (from all their roles):

```python
from app.crud import user as user_crud

# Get user's permissions as a list of permission codes
permissions = user_crud.get_user_permissions(db, user_id)
# Returns: ["can_tally", "can_view_tally_logs", "can_manage_customers", ...]

# Get user's role IDs
role_ids = user_crud.get_user_role_ids(db, user_id)
# Returns: [1, 2, 3]

# Check if user has a specific role
from app.auth.dependencies import user_has_role
has_superadmin = user_has_role(user, 'SUPERADMIN')
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

Provides authentication state and methods to the entire React app, including RBAC permission checking:

```typescript
const { 
  user, 
  loading, 
  login, 
  logout, 
  isAuthenticated, 
  isSuperadmin,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions
} = useAuth();

// Check if user is authenticated
if (!isAuthenticated) {
  return <Navigate to="/login" />;
}

// Check if user is superadmin (has SUPERADMIN role)
if (!isSuperadmin) {
  return <Navigate to="/dashboard" />;
}

// Check if user has a specific permission
if (!hasPermission('can_manage_customers')) {
  return <div>You don't have permission to manage customers</div>;
}

// Check if user has any of the permissions
if (!hasAnyPermission(['can_tally', 'can_edit_tally_session'])) {
  return <div>You don't have permission to perform tally operations</div>;
}

// Check if user has all permissions
if (!hasAllPermissions(['can_manage_users', 'can_assign_basic_roles'])) {
  return <div>You need both user management and role assignment permissions</div>;
}
```

**Permission Checking Methods:**
- `hasPermission(code: string)`: Check if user has a specific permission
- `hasAnyPermission(codes: string[])`: Check if user has any of the specified permissions
- `hasAllPermissions(codes: string[])`: Check if user has all of the specified permissions
- `isSuperadmin`: Check if user has the SUPERADMIN role (bypasses all permission checks)

**User Object Structure:**
```typescript
interface User {
  id: number;
  username: string;
  email: string;
  role: string | null;  // Deprecated, kept for backward compatibility
  is_active: boolean;
  plant_ids: number[];
  role_ids: number[];  // RBAC role IDs
  permissions: string[];  // Aggregated permission codes from all roles
  timezone?: string;
  active_plant_id?: number;
  acceptable_difference_threshold: number;
  visible_tabs?: string[];
}
```

**Usage in Components:**
```typescript
import { useAuth } from '../contexts/AuthContext';

function CustomerPage() {
  const { hasPermission } = useAuth();
  
  return (
    <div>
      {hasPermission('can_manage_customers') && (
        <>
          <button onClick={handleCreate}>Add Customer</button>
          <button onClick={handleEdit}>Edit</button>
          <button onClick={handleDelete}>Delete</button>
        </>
      )}
      
      {hasPermission('can_view_tally_logs') && (
        <button onClick={handleViewLogs}>View Logs</button>
      )}
    </div>
  );
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

### Problem: User gets 403 "Permission required" error

**Symptoms:**
- API endpoint returns 403 Forbidden with message "Permission 'X' required"
- User is authenticated but doesn't have the required permission

**Cause**: User doesn't have the required permission via their assigned roles

**Solution:**
1. Check user's assigned roles:
```python
from app.crud import user as user_crud
role_ids = user_crud.get_user_role_ids(db, user_id)
```

2. Check user's aggregated permissions:
```python
permissions = user_crud.get_user_permissions(db, user_id)
print(permissions)  # Should include the required permission
```

3. Assign the required role or add permission to user's existing role:
   - Via API: `POST /api/v1/users/{user_id}` with updated `role_ids`
   - Or assign permission to role: `POST /api/v1/roles/{role_id}/permissions`

### Problem: User has role_ids but permissions list is empty

**Symptoms:**
- User has `role_ids` in `/auth/me` response
- But `permissions` array is empty

**Cause**: Assigned roles don't have any permissions, or roles don't exist

**Solution:**
1. Verify roles exist:
```python
from app.models import Role
roles = db.query(Role).filter(Role.id.in_(role_ids)).all()
```

2. Check if roles have permissions:
```python
for role in roles:
    print(f"Role {role.name} has {len(role.permissions)} permissions")
```

3. Assign permissions to roles via API or database

### Problem: Cannot edit or delete system role

**Symptoms:**
- API returns error when trying to edit/delete SUPERADMIN or ADMIN role

**Cause**: System roles (`is_system=true`) are protected and cannot be modified

**Solution:**
- This is by design for security. System roles cannot be edited or deleted
- Create custom roles instead if you need different permission sets

### Problem: Cannot delete role with assigned users

**Symptoms:**
- API returns error when trying to delete a role

**Cause**: Role has users assigned to it

**Solution:**
1. First, remove role from all users:
```python
from app.models import UserRole
db.query(UserRole).filter(UserRole.role_id == role_id).delete()
db.commit()
```

2. Then delete the role

Or use the API to update users' `role_ids` to remove the role assignment

### Problem: User with SUPERADMIN role still gets permission denied

**Symptoms:**
- User has SUPERADMIN role but gets 403 errors

**Cause**: Role name mismatch or role not properly assigned

**Solution:**
1. Verify user has SUPERADMIN role:
```python
from app.auth.dependencies import user_has_role
has_superadmin = user_has_role(user, 'SUPERADMIN')
```

2. Check role name is exactly "SUPERADMIN" (case-sensitive):
```python
from app.models import Role
superadmin_role = db.query(Role).filter(Role.name == 'SUPERADMIN').first()
user_roles = [r.name for r in user.roles]
print(user_roles)  # Should include 'SUPERADMIN'
```

3. Ensure user is assigned to the role via `user_roles` table

### Problem: Permission check not working in route

**Symptoms:**
- Route has permission check but it's not being enforced

**Cause**: Permission dependency not properly applied or SUPERADMIN bypass

**Solution:**
1. Verify route uses permission dependency:
```python
@router.post("/endpoint")
async def my_endpoint(
    current_user: User = Depends(require_permission("can_tally")),
    db: Session = Depends(get_db)
):
    pass
```

2. Check permission code matches exactly (case-sensitive)

3. Verify user is not SUPERADMIN (SUPERADMIN bypasses all checks)

4. Ensure user's roles have the permission assigned

---

## Database Schema

### Migration: 009_add_authentication_tables

**Location**: `backend/alembic/versions/009_add_authentication_tables.py`

Creates:
- `users` table
- `plant_permissions` table
- Indexes and constraints

### Migration: 010_add_rbac_tables

**Location**: `backend/alembic/versions/010_add_rbac_tables.py`

Creates the RBAC system tables:
- `roles` table - Role definitions
- `permissions` table - Permission definitions
- `role_permissions` table - Many-to-many relationship between roles and permissions
- `user_roles` table - Many-to-many relationship between users and roles

**Seeded Data:**
- System roles: SUPERADMIN, ADMIN
- Initial permissions: `can_tally`, `can_view_tally_logs`, `can_manage_weight_classes`, `can_manage_customers`
- SUPERADMIN role gets all permissions
- ADMIN role gets basic permissions
- Existing users migrated to new role system

### Migration: 011_deprecate_legacy_role_field

**Location**: `backend/alembic/versions/011_deprecate_legacy_role_field.py`

Deprecates the legacy `role` field:
- Makes `users.role` column nullable
- The RBAC system (roles, permissions, user_roles) is now the primary authorization system
- Legacy role column kept for backward compatibility but no longer required

### Migration: 012_add_additional_permissions

**Location**: `backend/alembic/versions/012_add_additional_permissions.py`

Adds additional permissions for comprehensive RBAC:
- Tally management permissions (edit, complete, cancel, delete)
- User management permissions (manage, delete, assign roles)
- Role management permissions (manage, delete, assign permissions)
- Plant management permissions
- Reporting permissions

**Run migrations:**
```bash
cd backend
alembic upgrade head
```

**Verify RBAC tables:**
```bash
python -c "from app.database import engine; from sqlalchemy import inspect; print(inspect(engine).get_table_names())"
```

Should include: `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `plant_permissions`

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
- **RBAC System**: Comprehensive role and permission management
  - **System Roles**: SUPERADMIN (full access, bypasses all checks), ADMIN (most permissions)
  - **Custom Roles**: Create roles with specific permission combinations
  - **Multiple Roles**: Users can have multiple roles, inheriting all permissions
  - **Granular Permissions**: Fine-grained control over features and operations
- **Dual Access Control**:
  - **Role Permissions**: Control what users can do (features)
  - **Plant Permissions**: Control where users can operate (data scope)
- **Token Lifetime**: 8 hours (configurable)
- **Security**: SECRET_KEY must be fixed and secure
- **Frontend**: Token stored in localStorage, added to all requests
- **Legacy Role Field**: Deprecated but kept for backward compatibility

**Key Files:**
- `app/models/user.py` - User model (with deprecated role field)
- `app/models/role.py` - Role model (RBAC)
- `app/models/permission.py` - Permission model (RBAC)
- `app/models/user_role.py` - User-Role association (RBAC)
- `app/models/role_permission.py` - Role-Permission association (RBAC)
- `app/models/plant_permission.py` - Plant permission model (data scope)
- `app/auth/jwt.py` - JWT token handling
- `app/auth/password.py` - Password hashing
- `app/auth/dependencies.py` - Auth dependencies (includes permission checks)
- `app/api/routes/auth.py` - Auth endpoints
- `app/api/routes/roles.py` - Role management endpoints (RBAC)
- `app/api/routes/permissions.py` - Permission listing endpoint (RBAC)
- `app/crud/user.py` - User CRUD (includes permission aggregation)
- `app/crud/role.py` - Role CRUD (RBAC)
- `seed_admin.py` - Create default admin
- `.env` - Configuration (SECRET_KEY)

**Related Documentation:**
- `PERMISSIONS_GUIDE.md` - Complete list of permissions and usage examples
- `RBAC_IMPLEMENTATION_SUMMARY.md` - RBAC system implementation details

---

*Last Updated: Based on current implementation*
*For questions or updates, refer to the codebase or update this document accordingly.*

