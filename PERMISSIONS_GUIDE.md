# Permissions Guide

This document outlines all available permissions in the Tally System RBAC implementation.

## Permission Categories

### 1. Tally Management (`tally`)
Core tally operations for daily use.

| Permission Code | Name | Description | Typical Users |
|----------------|------|-------------|---------------|
| `can_start_tally` | Can Start Tally | Create new tally sessions | Tally Operators, Supervisors |
| `can_view_tally_logs` | Can See Tally Logs | View tally log entries | All Staff |
| `can_edit_tally_session` | Can Edit Tally Session | Edit tally session details | Supervisors, Managers |
| `can_complete_tally` | Can Complete Tally | Mark tally sessions as completed | Supervisors, Managers |
| `can_cancel_tally` | Can Cancel Tally | Cancel tally sessions | Supervisors, Managers |
| `can_delete_tally_session` | Can Delete Tally Session | Delete tally sessions (dangerous!) | Managers only |
| `can_edit_tally_entries` | Can Edit Tally Entries | Edit tally log entries | Supervisors, Managers |
| `can_delete_tally_entries` | Can Delete Tally Entries | Delete tally log entries | Managers only |

### 2. Management (`management`)
Basic data management operations.

| Permission Code | Name | Description | Typical Users |
|----------------|------|-------------|---------------|
| `can_manage_weight_classes` | Can Add/Edit/Delete Weight Classes | Manage weight classification definitions | Inventory Managers |
| `can_manage_customers` | Can Add/Edit/Delete Customers | Manage customer records | Sales, Managers |

### 3. User Management (`user_management`)
User account administration (split by sensitivity).

| Permission Code | Name | Description | Typical Users |
|----------------|------|-------------|---------------|
| `can_manage_users` | Can Manage Users | Create and edit regular users (non-admin) | HR, IT Support |
| `can_delete_users` | Can Delete Users | Delete user accounts | HR Managers, IT Admins |
| `can_assign_basic_roles` | Can Assign Basic Roles | Assign non-admin roles to users | HR, Managers |
| `can_assign_admin_roles` | Can Assign Admin Roles | Assign ADMIN/SUPERADMIN roles (restricted!) | SUPERADMIN only |

### 4. Role Management (`role_management`)
RBAC system administration.

| Permission Code | Name | Description | Typical Users |
|----------------|------|-------------|---------------|
| `can_manage_roles` | Can Manage Roles | Create and edit custom roles | IT Admins, SUPERADMIN |
| `can_delete_roles` | Can Delete Roles | Delete custom roles | IT Admins, SUPERADMIN |
| `can_assign_permissions` | Can Assign Permissions | Assign permissions to roles | IT Admins, SUPERADMIN |

### 5. Plant Management (`plant_management`)
Plant/facility administration.

| Permission Code | Name | Description | Typical Users |
|----------------|------|-------------|---------------|
| `can_manage_plants` | Can Manage Plants | Create, edit, and delete plants | Facility Managers, SUPERADMIN |
| `can_view_all_plants` | Can View All Plants | View plants not assigned to user | Managers, Auditors |

### 6. Reporting (`reporting`)
Data export and reporting capabilities.

| Permission Code | Name | Description | Typical Users |
|----------------|------|-------------|---------------|
| `can_export_data` | Can Export Data | Export tally data and reports | Managers, Accounting |

---

## Default Role Permissions

### SUPERADMIN (System Role)
**Has ALL permissions** - full system access (no restrictions)

### ADMIN (System Role)
**Has ALL permissions EXCEPT:**
- ❌ `can_view_all_plants` - Can only view assigned plants
- ❌ `can_assign_admin_roles` - Cannot elevate users to admin status

**This means ADMIN can:**
- ✅ Manage users (create, edit, delete)
- ✅ Assign basic roles to users
- ✅ Manage roles and permissions
- ✅ Manage plants (within their access)
- ✅ All tally operations (start, edit, complete, cancel, delete)
- ✅ Manage customers and weight classes
- ✅ Export data

**But ADMIN cannot:**
- ❌ View plants they're not assigned to
- ❌ Make other users ADMIN or SUPERADMIN

---

## Example Custom Roles

### Tally Operator
**Purpose:** Daily tally operations
**Permissions:**
- `can_start_tally`
- `can_view_tally_logs`
- `can_view_weight_classes` (if implemented)
- `can_view_customers` (if implemented)

### Inventory Manager
**Purpose:** Manage inventory classifications and complete tallies
**Permissions:**
- `can_manage_weight_classes`
- `can_view_tally_logs`
- `can_complete_tally`
- `can_export_data`

### HR Manager
**Purpose:** User account management (non-admin users)
**Permissions:**
- `can_manage_users`
- `can_assign_basic_roles`
- `can_delete_users`

### Plant Manager
**Purpose:** Full management of their assigned plant
**Permissions:**
- `can_manage_users`
- `can_manage_roles`
- `can_manage_customers`
- `can_manage_weight_classes`
- `can_start_tally`
- `can_view_tally_logs`
- `can_edit_tally_session`
- `can_complete_tally`
- `can_cancel_tally`
- `can_export_data`

### System Administrator
**Purpose:** Full system configuration (except user elevation)
**Permissions:**
- `can_manage_users`
- `can_delete_users`
- `can_assign_basic_roles` (NOT `can_assign_admin_roles`)
- `can_manage_roles`
- `can_delete_roles`
- `can_assign_permissions`
- `can_manage_plants`
- `can_view_all_plants`

---

## Permission Guidelines

### Security Best Practices

1. **Principle of Least Privilege**: Only assign permissions users actually need
2. **Separation of Duties**: Avoid giving one role too many sensitive permissions
3. **Regular Audits**: Review and update role permissions periodically

### Sensitive Permissions ⚠️

These permissions should be assigned carefully:

- **`can_assign_admin_roles`** - Can elevate users to admin status
- **`can_delete_users`** - Can remove user accounts
- **`can_delete_roles`** - Could affect many users
- **`can_delete_tally_session`** - Removes historical data
- **`can_delete_tally_entries`** - Alters records

### Combined with Plant Access

Remember: Permissions control **what** users can do, but **plant permissions** control **where** they can do it.

**Example:**
- User has `can_start_tally` permission
- User has access to Plant A and Plant B
- Result: User can start tallies in Plants A and B, but NOT Plant C

**Exception:**
- Users with SUPERADMIN role have access to ALL plants automatically

---

## API Endpoints Protected by Permissions

### User Management
- `POST /api/v1/users` - Requires: `can_manage_users` OR `can_assign_admin_roles`
- `PUT /api/v1/users/{id}` - Requires: `can_manage_users` OR `can_assign_admin_roles`
- `DELETE /api/v1/users/{id}` - Requires: `can_delete_users`

### Role Management
- `POST /api/v1/roles` - Requires: `can_manage_roles`
- `PUT /api/v1/roles/{id}` - Requires: `can_manage_roles`
- `DELETE /api/v1/roles/{id}` - Requires: `can_delete_roles`
- `POST /api/v1/roles/{id}/permissions` - Requires: `can_assign_permissions`

### Tally Operations
- `POST /api/v1/tally-sessions` - Requires: `can_start_tally`
- `POST /api/v1/tally-log-entries` - Requires: `can_start_tally`
- `GET /api/v1/tally-log-entries` - Requires: `can_view_tally_logs`

### Management Operations
- `POST/PUT/DELETE /api/v1/weight-classifications` - Requires: `can_manage_weight_classes`
- `POST/PUT/DELETE /api/v1/customers` - Requires: `can_manage_customers`
- `POST/PUT/DELETE /api/v1/plants` - Requires: `can_manage_plants` (or SUPERADMIN)

---

## Migration Notes

### Adding Permissions (Migration 012)
Run: `alembic upgrade head`

This migration adds all hybrid approach permissions and assigns them to:
- **SUPERADMIN**: All permissions
- **ADMIN**: Basic operational permissions

### Custom Roles
After migration, you can create custom roles via:
1. Web UI: `/roles` page
2. API: `POST /api/v1/roles`

---

## Future Enhancements

Potential additions based on usage:

- `can_view_audit_logs` - View system audit trail
- `can_edit_system_settings` - Modify system configuration
- `can_generate_reports` - Create custom reports
- `can_approve_tallies` - Multi-level approval workflow
- `can_edit_own_entries_only` - Restrict to user's own entries

---

## Support

For questions or permission requests, contact your system administrator.

