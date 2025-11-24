"""add_additional_permissions

Revision ID: 012_add_additional_permissions
Revises: 011_deprecate_legacy_role_field
Create Date: 2025-01-24 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from datetime import datetime


# revision identifiers, used by Alembic.
revision = '012_add_additional_permissions'
down_revision = '011_deprecate_legacy_role_field'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Add additional permissions for the hybrid RBAC approach.
    Organized by category with clear separation of sensitive operations.
    """
    now = datetime.utcnow()
    
    # New permissions to add (organized by category)
    new_permissions = [
        # User Management
        {
            'code': 'can_manage_users',
            'name': 'Can Manage Users',
            'description': 'Create and edit regular users (non-admin)',
            'category': 'user_management'
        },
        {
            'code': 'can_delete_users',
            'name': 'Can Delete Users',
            'description': 'Delete user accounts',
            'category': 'user_management'
        },
        {
            'code': 'can_assign_basic_roles',
            'name': 'Can Assign Basic Roles',
            'description': 'Assign non-admin roles to users',
            'category': 'user_management'
        },
        {
            'code': 'can_assign_admin_roles',
            'name': 'Can Assign Admin Roles',
            'description': 'Assign ADMIN and SUPERADMIN roles (highly restricted)',
            'category': 'user_management'
        },
        
        # Role & Permission Management
        {
            'code': 'can_manage_roles',
            'name': 'Can Manage Roles',
            'description': 'Create and edit custom roles',
            'category': 'role_management'
        },
        {
            'code': 'can_delete_roles',
            'name': 'Can Delete Roles',
            'description': 'Delete custom roles',
            'category': 'role_management'
        },
        {
            'code': 'can_assign_permissions',
            'name': 'Can Assign Permissions',
            'description': 'Assign permissions to roles',
            'category': 'role_management'
        },
        
        # Plant Management
        {
            'code': 'can_manage_plants',
            'name': 'Can Manage Plants',
            'description': 'Create, edit, and delete plants',
            'category': 'plant_management'
        },
        {
            'code': 'can_view_all_plants',
            'name': 'Can View All Plants',
            'description': 'View plants not assigned to the user',
            'category': 'plant_management'
        },
        
        # Tally Session Management
        {
            'code': 'can_edit_tally_session',
            'name': 'Can Edit Tally Session',
            'description': 'Edit tally session details',
            'category': 'tally_management'
        },
        {
            'code': 'can_complete_tally',
            'name': 'Can Complete Tally',
            'description': 'Mark tally sessions as completed',
            'category': 'tally_management'
        },
        {
            'code': 'can_cancel_tally',
            'name': 'Can Cancel Tally',
            'description': 'Cancel tally sessions',
            'category': 'tally_management'
        },
        {
            'code': 'can_delete_tally_session',
            'name': 'Can Delete Tally Session',
            'description': 'Delete tally sessions (dangerous operation)',
            'category': 'tally_management'
        },
        
        # Tally Entries
        {
            'code': 'can_edit_tally_entries',
            'name': 'Can Edit Tally Entries',
            'description': 'Edit tally log entries',
            'category': 'tally_management'
        },
        {
            'code': 'can_delete_tally_entries',
            'name': 'Can Delete Tally Entries',
            'description': 'Delete tally log entries',
            'category': 'tally_management'
        },
        
        # Export & Reporting
        {
            'code': 'can_export_data',
            'name': 'Can Export Data',
            'description': 'Export tally data and reports',
            'category': 'reporting'
        },
    ]
    
    # Insert new permissions
    for perm in new_permissions:
        op.execute(
            text(
                "INSERT INTO permissions (code, name, description, category, created_at) "
                "VALUES (:code, :name, :description, :category, :created_at)"
            ).bindparams(
                code=perm['code'],
                name=perm['name'],
                description=perm['description'],
                category=perm['category'],
                created_at=now
            )
        )
    
    # Assign ALL permissions to SUPERADMIN role (they should have everything)
    op.execute(
        text(
            "INSERT INTO role_permissions (role_id, permission_id, created_at) "
            "SELECT r.id, p.id, :created_at FROM roles r CROSS JOIN permissions p "
            "WHERE r.name = 'SUPERADMIN' "
            "AND p.code IN ("
            "'can_manage_users', 'can_delete_users', 'can_assign_basic_roles', 'can_assign_admin_roles', "
            "'can_manage_roles', 'can_delete_roles', 'can_assign_permissions', "
            "'can_manage_plants', 'can_view_all_plants', "
            "'can_edit_tally_session', 'can_complete_tally', 'can_cancel_tally', 'can_delete_tally_session', "
            "'can_edit_tally_entries', 'can_delete_tally_entries', "
            "'can_export_data'"
            ") "
            "AND NOT EXISTS ("
            "  SELECT 1 FROM role_permissions rp2 "
            "  WHERE rp2.role_id = r.id AND rp2.permission_id = p.id"
            ")"
        ).bindparams(created_at=now)
    )
    
    # Assign all permissions to ADMIN role EXCEPT can_view_all_plants and can_assign_admin_roles
    # ADMIN can do everything except view plants they don't have access to and elevate users to admin
    op.execute(
        text(
            "INSERT INTO role_permissions (role_id, permission_id, created_at) "
            "SELECT r.id, p.id, :created_at FROM roles r CROSS JOIN permissions p "
            "WHERE r.name = 'ADMIN' "
            "AND p.code NOT IN ('can_view_all_plants', 'can_assign_admin_roles') "
            "AND NOT EXISTS ("
            "  SELECT 1 FROM role_permissions rp2 "
            "  WHERE rp2.role_id = r.id AND rp2.permission_id = p.id"
            ")"
        ).bindparams(created_at=now)
    )


def downgrade() -> None:
    """
    Remove the additional permissions added in this migration.
    """
    # Delete role_permissions entries for these permissions
    op.execute(
        text(
            "DELETE FROM role_permissions WHERE permission_id IN ("
            "  SELECT id FROM permissions WHERE code IN ("
            "    'can_manage_users', 'can_delete_users', 'can_assign_basic_roles', 'can_assign_admin_roles', "
            "    'can_manage_roles', 'can_delete_roles', 'can_assign_permissions', "
            "    'can_manage_plants', 'can_view_all_plants', "
            "    'can_edit_tally_session', 'can_complete_tally', 'can_cancel_tally', 'can_delete_tally_session', "
            "    'can_edit_tally_entries', 'can_delete_tally_entries', "
            "    'can_export_data'"
            "  )"
            ")"
        )
    )
    
    # Delete the permissions
    op.execute(
        text(
            "DELETE FROM permissions WHERE code IN ("
            "'can_manage_users', 'can_delete_users', 'can_assign_basic_roles', 'can_assign_admin_roles', "
            "'can_manage_roles', 'can_delete_roles', 'can_assign_permissions', "
            "'can_manage_plants', 'can_view_all_plants', "
            "'can_edit_tally_session', 'can_complete_tally', 'can_cancel_tally', 'can_delete_tally_session', "
            "'can_edit_tally_entries', 'can_delete_tally_entries', "
            "'can_export_data'"
            ")"
        )
    )

