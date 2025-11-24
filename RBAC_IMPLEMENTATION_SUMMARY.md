# RBAC System Implementation Summary

## Overview
A comprehensive Role-Based Access Control (RBAC) system has been implemented for the Tally System, supporting both web and mobile applications with custom roles, granular permissions, and dual access control (feature permissions + plant-based data access).

## What Has Been Implemented

### Backend (Complete ✅)

#### 1. Database Schema
- **File**: `backend/alembic/versions/010_add_rbac_tables.py`
- **Tables Created**:
  - `roles` - Custom and system roles
  - `permissions` - Available system permissions
  - `role_permissions` - Maps permissions to roles (many-to-many)
  - `user_roles` - Maps users to roles (many-to-many)
- **Seeded Data**:
  - 4 permissions: `can_start_tally`, `can_view_tally_logs`, `can_manage_weight_classes`, `can_manage_customers`
  - 2 system roles: SUPERADMIN (all permissions), ADMIN (basic permissions)
  - Existing users migrated to new role system

#### 2. Models
- `backend/app/models/role.py` - Role model
- `backend/app/models/permission.py` - Permission model
- `backend/app/models/role_permission.py` - RolePermission association
- `backend/app/models/user_role.py` - UserRole association
- Updated `user.py` with roles relationship

#### 3. Schemas
- `backend/app/schemas/role.py` - RoleCreate, RoleUpdate, RoleResponse, RoleWithPermissions
- `backend/app/schemas/permission.py` - PermissionResponse
- Updated `user.py` with `role_ids` and `permissions` fields

#### 4. CRUD Operations
- `backend/app/crud/role.py` - Role CRUD operations
- `backend/app/crud/permission.py` - Permission queries
- `backend/app/crud/user_role.py` - User-role assignment operations
- Updated `user.py` with permission aggregation functions

#### 5. API Routes
- `backend/app/api/routes/roles.py` - Role management endpoints
- `backend/app/api/routes/permissions.py` - Permission listing endpoint
- Updated `auth.py` - `/auth/me` now includes role_ids and permissions
- Updated `users.py` - User endpoints include role assignments
- Registered in `main.py`

#### 6. Auth Dependencies
- `backend/app/auth/dependencies.py` - Added permission checking functions:
  - `require_permission(permission_code)` - Check single permission
  - `require_any_permission(permission_codes)` - Check any of multiple permissions
  - `require_permission_and_plant_access(permission_code, plant_id)` - Combined check

#### 7. Protected Routes Updated
- **customers.py**: Create/Update/Delete require `can_manage_customers`
- **weight_classifications.py**: Create/Update/Delete require `can_manage_weight_classes`
- **tally_sessions.py**: Create requires `can_start_tally`
- **tally_log_entries.py**: 
  - GET requires `can_view_tally_logs`
  - POST/DELETE require `can_start_tally`

### Frontend Web (Core Complete ✅)

#### 1. Types
- `web/src/types/index.ts` - Added Role, Permission, RoleWithPermissions types
- Updated User interface with `role_ids` and `permissions` fields

#### 2. API Service
- `web/src/services/api.ts` - Added rolesApi and permissionsApi endpoints

#### 3. Auth Context
- `web/src/contexts/AuthContext.tsx` - Added permission checking functions:
  - `hasPermission(code)` - Check if user has a specific permission
  - `hasAnyPermission(codes)` - Check if user has any of the permissions
  - `hasAllPermissions(codes)` - Check if user has all permissions

#### 4. Usage Pattern
```typescript
import { useAuth } from '../contexts/AuthContext';

function MyComponent() {
  const { hasPermission } = useAuth();
  
  return (
    <div>
      {hasPermission('can_manage_customers') && (
        <button onClick={handleCreate}>Add Customer</button>
      )}
    </div>
  );
}
```

### Frontend Mobile (Core Complete ✅)

#### 1. Types
- `mobile/src/types/index.ts` - Added complete RBAC types (Role, Permission, User with permissions)

#### 2. API Service
- `mobile/src/services/api.ts` - Added rolesApi and permissionsApi

#### 3. Permission Hook
- `mobile/src/utils/usePermissions.ts` - Created usePermissions hook
- Note: Requires integration with your AuthContext

#### 4. Usage Pattern
```typescript
import { usePermissions } from '../utils/usePermissions';

function TallyScreen() {
  const { hasPermission } = usePermissions();
  
  return (
    <View>
      {hasPermission('can_start_tally') && (
        <Button title="Start Tally" onPress={handleStartTally} />
      )}
    </View>
  );
}
```

## Architecture Highlights

### Dual Access Control System
The system implements two complementary authorization layers:

1. **Role-Based Permissions** (Feature Access) - Controls WHAT users can do
   - Managed via roles, permissions, role_permissions, user_roles tables
   - Examples: can_start_tally, can_manage_customers
   - Users can have multiple roles, inheriting all permissions

2. **Plant Permissions** (Data Scope) - Controls WHERE users can operate
   - Managed via existing plant_permissions table (unchanged)
   - SUPERADMIN users automatically access all plants
   - Regular users need explicit plant access assignments

**Combined Authorization**: To perform an action on a plant, a user must:
- Have the required permission (via their assigned role(s))
- AND have access to that specific plant (via plant_permissions)
- SUPERADMIN automatically passes both checks

### Permission Codes
- `can_start_tally` - Create tally sessions and log entries
- `can_view_tally_logs` - View tally log entries and history
- `can_manage_weight_classes` - Add/edit/delete weight classifications
- `can_manage_customers` - Add/edit/delete customers

### System Roles
- **SUPERADMIN** - Full access to all features and plants (is_system=true, cannot be edited)
- **ADMIN** - Limited access with basic permissions (is_system=true, cannot be edited)
- **Custom Roles** - Can be created by SUPERADMIN and ADMIN users

## Next Steps to Complete Implementation

### 1. Run Database Migration
```bash
cd backend
# Activate virtual environment
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Run migration
alembic upgrade head

# Verify tables were created
python -c "from app.database import engine; from sqlalchemy import inspect; print(inspect(engine).get_table_names())"
```

### 2. Test Backend API
Test the RBAC endpoints:
```bash
# Login as admin
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Get current user (should include role_ids and permissions)
curl -X GET http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# List roles
curl -X GET http://localhost:8000/api/v1/roles \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# List permissions
curl -X GET http://localhost:8000/api/v1/permissions \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 3. Create Role Management UI Pages (Web)
Create these pages in `web/src/pages/`:

**RoleListPage.tsx** - Display all roles, create button
```typescript
import { rolesApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

// Fetch roles, display in table
// Show "Create Role" button for SUPERADMIN and ADMIN
// Edit/Delete actions (disabled for system roles)
```

**RoleEditPage.tsx** - Edit role and assign permissions
```typescript
import { rolesApi, permissionsApi } from '../services/api';

// Form for role name and description
// List permissions grouped by category with checkboxes
// Cannot edit system roles (show warning)
```

**Update UserManagementPage.tsx**
- Replace single role dropdown with multi-select for roles
- Display user's aggregated permissions

### 4. Add Conditional Rendering (Web)
Update existing pages to use `hasPermission`:

```typescript
// Example: CustomerPage.tsx
const { hasPermission } = useAuth();

{hasPermission('can_manage_customers') && (
  <>
    <Button onClick={handleCreate}>Add Customer</Button>
    <Button onClick={handleEdit}>Edit</Button>
    <Button onClick={handleDelete}>Delete</Button>
  </>
)}
```

Apply to:
- TallySessionsPage - `can_start_tally`
- WeightClassificationsPage - `can_manage_weight_classes`
- CustomersPage - `can_manage_customers`
- TallyLogPage - `can_view_tally_logs`

### 5. Integrate Mobile AuthContext
Update the `usePermissions` hook in `mobile/src/utils/usePermissions.ts` to get the actual user from your AuthContext:

```typescript
import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';

export const usePermissions = () => {
  const { user } = useContext(AuthContext);
  
  const hasPermission = (code: string): boolean => {
    if (!user) return false;
    if (user.role === 'superadmin') return true;
    return user.permissions?.includes(code) || false;
  };
  
  // ... rest of implementation
};
```

### 6. Add Conditional Rendering (Mobile)
Apply permission checks to mobile screens similar to web implementation.

### 7. Update Navigation
Add role management menu items to web dashboard (visible to SUPERADMIN and ADMIN).

## API Endpoints Reference

### Roles
- `GET /api/v1/roles` - List all roles
- `GET /api/v1/roles/{role_id}` - Get role with permissions
- `POST /api/v1/roles` - Create role (SUPERADMIN/ADMIN)
- `PUT /api/v1/roles/{role_id}` - Update role (SUPERADMIN/ADMIN)
- `DELETE /api/v1/roles/{role_id}` - Delete role (SUPERADMIN/ADMIN)
- `POST /api/v1/roles/{role_id}/permissions` - Assign permissions
- `DELETE /api/v1/roles/{role_id}/permissions/{permission_id}` - Remove permission

### Permissions
- `GET /api/v1/permissions` - List all permissions

### Users (Updated)
- `GET /api/v1/auth/me` - Now includes role_ids and permissions
- User CRUD endpoints now accept role_ids for role assignments

## Security Notes

1. **System Roles**: SUPERADMIN and ADMIN roles cannot be edited or deleted
2. **Role Deletion**: Cannot delete roles with assigned users
3. **Permission Validation**: All permission codes validated on assignment
4. **Plant Access**: Remains separate from role permissions for data scoping
5. **SUPERADMIN Bypass**: SUPERADMIN users bypass all permission checks

## Files Created/Modified

### Backend Files Created (11)
- `backend/alembic/versions/010_add_rbac_tables.py`
- `backend/app/models/role.py`
- `backend/app/models/permission.py`
- `backend/app/models/role_permission.py`
- `backend/app/models/user_role.py`
- `backend/app/schemas/role.py`
- `backend/app/schemas/permission.py`
- `backend/app/crud/role.py`
- `backend/app/crud/permission.py`
- `backend/app/crud/user_role.py`
- `backend/app/api/routes/roles.py`
- `backend/app/api/routes/permissions.py`

### Backend Files Modified (9)
- `backend/app/models/__init__.py`
- `backend/app/models/user.py`
- `backend/app/schemas/__init__.py`
- `backend/app/schemas/user.py`
- `backend/app/crud/__init__.py`
- `backend/app/crud/user.py`
- `backend/app/auth/dependencies.py`
- `backend/app/api/routes/auth.py`
- `backend/app/api/routes/users.py`
- `backend/app/api/routes/customers.py`
- `backend/app/api/routes/weight_classifications.py`
- `backend/app/api/routes/tally_sessions.py`
- `backend/app/api/routes/tally_log_entries.py`
- `backend/app/main.py`

### Frontend Web Files Modified (3)
- `web/src/types/index.ts`
- `web/src/services/api.ts`
- `web/src/contexts/AuthContext.tsx`

### Frontend Mobile Files Created (1)
- `mobile/src/utils/usePermissions.ts`

### Frontend Mobile Files Modified (2)
- `mobile/src/types/index.ts`
- `mobile/src/services/api.ts`

## Testing Checklist

- [ ] Run database migration successfully
- [ ] Login and verify `/auth/me` includes role_ids and permissions
- [ ] Create a custom role via API
- [ ] Assign permissions to custom role
- [ ] Assign custom role to a user
- [ ] Verify user inherits permissions from all roles
- [ ] Test permission-protected endpoints (should get 403 without permission)
- [ ] Test SUPERADMIN bypass (should have all permissions)
- [ ] Test plant access combined with permissions
- [ ] Cannot edit/delete system roles
- [ ] Cannot delete role with assigned users
- [ ] Web: Test hasPermission in UI components
- [ ] Mobile: Test usePermissions hook

## Support

For questions or issues with the RBAC implementation:
1. Check the plan document: `/rb.plan.md`
2. Review the AUTH_GUIDE.md for authentication details
3. Check this summary for architecture overview

---

**Implementation Date**: January 24, 2025
**Status**: Backend Complete, Frontend Core Complete, UI Creation Pending

