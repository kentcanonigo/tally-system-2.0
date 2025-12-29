# Permissions Guide

This document outlines all available permissions in the Tally System RBAC implementation.

## Permission Categories

### 1. Tally Management (`tally`)
Core tally operations for daily use.

#### Session Management
| Permission Code | Name | Description | Backend Enforced | Typical Users |
|----------------|------|-------------|------------------|---------------|
| `can_create_tally_sessions` | Can Create Tally Sessions | Create new tally sessions | ✅ Yes | Tally Operators, Supervisors |
| `can_edit_tally_session` | Can Edit Tally Session | Edit session details (customer, plant, date) | ✅ Yes | Supervisors, Managers |
| `can_complete_tally` | Can Complete Tally | Mark tally sessions as completed | ✅ Yes | Supervisors, Managers |
| `can_cancel_tally` | Can Cancel Tally | Cancel tally sessions | ✅ Yes | Supervisors, Managers |
| `can_delete_tally_session` | Can Delete Tally Session | Delete tally sessions (dangerous!) | ✅ Yes | Managers only |

#### Allocation Management
| Permission Code | Name | Description | Backend Enforced | Typical Users |
|----------------|------|-------------|------------------|---------------|
| `can_edit_tally_allocations` | Can Edit Tally Allocations | Edit allocation details (requirements/plans for what needs to be tallied) | ✅ Yes | Supervisors, Managers |
| `can_delete_tally_allocations` | Can Delete Tally Allocations | Delete allocation details (removes requirements and all associated tally log entries) | ✅ Yes | Managers only |

#### Tally Log Entry Management
| Permission Code | Name | Description | Backend Enforced | Typical Users |
|----------------|------|-------------|------------------|---------------|
| `can_view_tally_logs` | Can View Tally Logs | View tally log entries and full allocation details (with progress/completion data) | ✅ Yes | All Staff |
| `can_tally_as_tallyer` | Can Tally as Tally-er | Allows creating tally log entries with the Tally-er role | ✅ Yes | Tally Operators |
| `can_tally_as_dispatcher` | Can Tally as Dispatcher | Allows creating tally log entries with the Dispatcher role | ✅ Yes | Dispatchers |
| `can_edit_tally_log_entries` | Can Edit Tally Log Entries | Edit individual tally log entries (work records of what was actually tallied) | ✅ Yes | Supervisors, Managers |
| `can_delete_tally_log_entries` | Can Delete Tally Log Entries | Delete individual tally log entries (removes one work record, decrements allocation counts) | ✅ Yes | Supervisors, Managers |
| `can_transfer_tally_log_entries` | Can Transfer Tally Log Entries | Transfer individual tally log entries between sessions (moves work records) | ✅ Yes | Supervisors, Managers |

**Note:** 
- **Allocation details** are the requirements/plans for what needs to be tallied in a session
- **Tally log entries** are the actual work records of what was tallied
- `can_tally_as_tallyer` is checked by default when creating new roles
- The legacy `can_tally` permission is still supported for backward compatibility but is being phased out in favor of the more granular `can_tally_as_tallyer` and `can_tally_as_dispatcher` permissions

**Note:** All permissions listed above are now properly enforced in the backend API. The UI checks are in addition to backend enforcement for better user experience.

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
- `can_create_tally_sessions` - Create new sessions
- `can_tally_as_tallyer` - Add entries to tally logs as Tally-er (checked by default for new roles)
- `can_view_tally_logs` - View log entries and allocation details (optional - for viewing progress)
- `can_view_weight_classes` (if implemented)
- `can_view_customers` (if implemented)

### Dispatcher
**Purpose:** Dispatcher tally operations
**Permissions:**
- `can_create_tally_sessions` - Create new sessions
- `can_tally_as_dispatcher` - Add entries to tally logs as Dispatcher
- `can_view_tally_logs` - View log entries and allocation details (optional - for viewing progress)

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
- `can_create_tally_sessions` - Create new sessions
- `can_tally_as_tallyer` - Add entries to tally logs as Tally-er
- `can_tally_as_dispatcher` - Add entries to tally logs as Dispatcher
- `can_view_tally_logs`
- `can_edit_tally_session`
- `can_edit_tally_allocations`
- `can_delete_tally_allocations`
- `can_edit_tally_log_entries` - Edit individual log entries
- `can_delete_tally_log_entries` - Delete individual log entries
- `can_transfer_tally_log_entries` - Transfer log entries between sessions
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
- **`can_delete_tally_allocations`** - Removes requirements and all associated log entries
- **`can_delete_tally_log_entries`** - Removes individual work records
- **`can_transfer_tally_log_entries`** - Can move work records between sessions

### Combined with Plant Access

Remember: Permissions control **what** users can do, but **plant permissions** control **where** they can do it.

**Example:**
- User has `can_tally_as_tallyer` permission
- User has access to Plant A and Plant B
- Result: User can add tally entries as Tally-er in Plants A and B, but NOT Plant C

**Exception:**
- Users with SUPERADMIN role have access to ALL plants automatically

---

## UI Behavior Based on Permissions

### Web Dashboard UI Controls

The web dashboard automatically shows/hides or disables UI elements based on user permissions:

#### Plants Page
- **Add Plant button**: Disabled if user lacks `can_manage_plants` permission

#### Weight Classifications Page
- **Add Weight Classification button**: Disabled if user lacks `can_manage_weight_classes` permission

#### Tally Session Details Page
- **View Logs button**: Hidden if user lacks `can_view_tally_logs` permission
- **Export PDF button**: Hidden if user lacks `can_export_data` permission
- **Start Tally button**: Disabled if user lacks both `can_tally_as_tallyer` and `can_tally_as_dispatcher` permissions
- **Start Tally role selection**: Only shows roles the user has permission for (`can_tally_as_tallyer` or `can_tally_as_dispatcher`)
- **Reset Tally-er Allocations button**: Only visible to ADMIN or SUPERADMIN roles
- **Reset Dispatcher Allocations button**: Only visible to ADMIN or SUPERADMIN roles
- **Heads column**: Hidden in allocations table if user lacks `can_view_tally_logs` permission
- **Allocations table**: Always visible (users can view allocations even without log viewing permission)

#### Tally Session Logs Page (Web & Mobile)
- **Select Entries button**: Visible if user has `can_edit_tally_log_entries`, `can_delete_tally_log_entries`, or `can_transfer_tally_log_entries`
- **Edit button** (individual entries): Visible and enabled if user has `can_edit_tally_log_entries`
- **Delete button** (individual entries): Visible and enabled if user has `can_delete_tally_log_entries`
- **Transfer Selected button**: Visible and enabled if user has `can_transfer_tally_log_entries` and entries are selected
- **Delete Selected button**: Visible and enabled if user has `can_delete_tally_log_entries` and entries are selected

#### Tally Tab Screen (Mobile)
- **Role dropdown**: Only visible if user has `can_tally_as_tallyer` or `can_tally_as_dispatcher`
- **Tallyer option**: Only shown if user has `can_tally_as_tallyer` permission
- **Dispatcher option**: Only shown if user has `can_tally_as_dispatcher` permission
- **Role dropdown button**: Disabled if user has neither permission

#### Navigation Sidebar
- **Export link**: Hidden if user lacks `can_export_data` permission

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
- `POST /api/v1/tally-sessions` - Requires: `can_create_tally_sessions`
- `POST /api/v1/tally-sessions/{id}/log-entries` - Requires: `can_tally_as_tallyer` (if role=tally) OR `can_tally_as_dispatcher` (if role=dispatcher)
- `GET /api/v1/tally-log-entries` - Requires: `can_view_tally_logs`
- `PUT /api/v1/log-entries/{id}` - Requires: `can_edit_tally_log_entries`
- `DELETE /api/v1/log-entries/{id}` - Requires: `can_delete_tally_log_entries`
- `POST /api/v1/log-entries/transfer` - Requires: `can_transfer_tally_log_entries`
- `POST /api/v1/tally-sessions/{id}/allocations` - Requires: `can_edit_tally_allocations`
- `PUT /api/v1/allocations/{id}` - Requires: `can_edit_tally_allocations`
- `DELETE /api/v1/allocations/{id}` - Requires: `can_delete_tally_allocations`

### Management Operations
- `POST/PUT/DELETE /api/v1/weight-classifications` - Requires: `can_manage_weight_classes`
- `POST/PUT/DELETE /api/v1/customers` - Requires: `can_manage_customers`
- `POST/PUT/DELETE /api/v1/plants` - Requires: `can_manage_plants` (or SUPERADMIN)

### Export Operations
- `POST /api/v1/export/sessions` - Requires: `can_export_data`

---

## Migration Notes

### Adding Permissions

#### Migration 012
Initial hybrid approach permissions added and assigned to:
- **SUPERADMIN**: All permissions
- **ADMIN**: Basic operational permissions

#### Migration 021
Added tally log entry management permissions:
- `can_edit_tally_log_entries`
- `can_delete_tally_log_entries`
- `can_transfer_tally_log_entries`
- Assigned to **SUPERADMIN** and **ADMIN** roles by default

#### Migration 022
Added role-based tallying permissions:
- `can_tally_as_tallyer` - Allows creating tally log entries with the Tally-er role
- `can_tally_as_dispatcher` - Allows creating tally log entries with the Dispatcher role
- Assigned to **SUPERADMIN** and **ADMIN** roles by default
- `can_tally_as_tallyer` is checked by default when creating new roles

#### Migration 023
Updated permission descriptions to clarify the distinction between:
- **Allocation details** (requirements/plans for what needs to be tallied)
- **Tally log entries** (work records of what was actually tallied)

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

