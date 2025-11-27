# Console Commands Documentation

## Overview

The Admin Console is a powerful administrative tool that allows superadmin users to execute system-level commands. This feature is accessible through the Settings page in the web application and provides a secure way to perform critical database operations.

## Access Requirements

- **Frontend Visibility**: Admin and Superadmin users can see the "Open Console" button in the Settings page
- **Backend Execution**: Only Superadmin users can actually execute console commands
- **Security**: All console commands require superadmin authentication via JWT token

## Location

- **Web UI**: Settings page → Admin Console section → "Open Console" button
- **API Endpoint**: `POST /api/v1/console`
- **Backend Route**: `backend/app/api/routes/console.py`

## Available Commands

### `delete_everything`

Permanently purges all data from the database while preserving the authentication and authorization system.

#### What Gets Deleted:
- All tally sessions
- All allocation details
- All tally log entries
- All weight classifications
- All customers
- All plants
- All plant permissions

#### What Gets Preserved:
- Users (authentication accounts)
- Roles (RBAC roles)
- Permissions (system permissions)
- Role assignments (user-role relationships)
- Permission assignments (role-permission relationships)

#### Usage:
1. Open the Admin Console from Settings
2. Enter command: `delete_everything`
3. Click "Execute"
4. Review the confirmation dialog carefully
5. Confirm the deletion by clicking "Yes, Delete Everything"

#### Warning:
⚠️ **This action cannot be undone!** All operational data will be permanently deleted. Only the user accounts and permission structure will remain.

#### Response:
The command returns a success message along with:
- List of tables that were purged
- List of tables that were preserved
- Count of records deleted from each table

## API Reference

### Endpoint
```
POST /api/v1/console
```

### Request Body
```json
{
  "command": "delete_everything",
  "args": {}
}
```

### Response (Success)
```json
{
  "success": true,
  "message": "Database purged successfully. All data has been deleted.",
  "data": {
    "tables_purged": [
      "tally_log_entries",
      "allocation_details",
      "tally_sessions",
      "weight_classifications",
      "customers",
      "plant_permissions",
      "plants"
    ],
    "tables_preserved": [
      "users",
      "roles",
      "permissions",
      "role_permissions",
      "user_roles"
    ],
    "deleted_counts": {
      "tally_log_entries": 0,
      "allocation_details": 0,
      "tally_sessions": 0,
      "weight_classifications": 0,
      "customers": 0,
      "plant_permissions": 0,
      "plants": 0
    }
  }
}
```

### Response (Error)
```json
{
  "detail": "Error message here"
}
```

## Implementation Details

### Backend Structure

The console command system is implemented in `backend/app/api/routes/console.py`:

- Uses FastAPI router with superadmin-only dependency
- Commands are processed in a case-insensitive manner
- All database operations use SQLAlchemy ORM for safety
- Transactions are used to ensure atomicity (rollback on error)

### Frontend Structure

The console UI is integrated into `web/src/pages/Settings.tsx`:

- Modal-based interface for command input
- Special confirmation dialogs for destructive commands
- Real-time feedback with success/error messages
- Loading states during command execution

## Adding New Commands

To add a new console command:

1. **Backend** (`backend/app/api/routes/console.py`):
   ```python
   if command == "your_new_command":
       try:
           # Your command logic here
           db.commit()
           return ConsoleCommandResponse(
               success=True,
               message="Command executed successfully",
               data={}
           )
       except Exception as e:
           db.rollback()
           raise HTTPException(
               status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
               detail=f"Error executing command: {str(e)}"
           )
   ```

2. **Frontend** (if special UI needed):
   - Add confirmation dialog in `web/src/pages/Settings.tsx` if the command is destructive
   - Update the `handleConsoleCommand` function if special handling is required

3. **Documentation**:
   - Add the command to this file with:
     - Description
     - What it does
     - Usage instructions
     - Warnings (if applicable)
     - Example request/response

## Security Considerations

1. **Authentication**: All console commands require valid JWT authentication
2. **Authorization**: Only superadmin users can execute commands
3. **Validation**: Commands are validated before execution
4. **Transaction Safety**: All database operations use transactions with rollback on error
5. **Audit Trail**: Consider adding logging for all console command executions (future enhancement)

## Future Enhancements

Potential commands to add:
- `backup_database` - Create a database backup
- `restore_database` - Restore from a backup
- `export_all_data` - Export all data to a file
- `reset_user_password` - Reset a user's password
- `sync_permissions` - Synchronize permissions across roles
- `cleanup_orphaned_data` - Remove orphaned records
- `generate_report` - Generate system reports
- `maintenance_mode` - Enable/disable maintenance mode

## Error Handling

- All commands use try-catch blocks
- Database transactions ensure atomicity
- Errors are returned with descriptive messages
- Frontend displays errors in a user-friendly format

## Testing

When testing console commands:
1. Always test in a development environment first
2. Verify database state before and after command execution
3. Test error scenarios (invalid commands, database errors, etc.)
4. Verify that preserved data remains intact
5. Test with non-superadmin users to verify access restrictions

## Notes

- Commands are case-insensitive
- Command arguments are optional and can be extended per command
- The console is designed to be extensible - new commands can be added easily
- All destructive commands should include confirmation dialogs in the UI

