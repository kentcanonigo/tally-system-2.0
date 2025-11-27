"""add_create_tally_sessions_permission

Revision ID: 015_add_create_tally_perm
Revises: 014_add_user_preferences
Create Date: 2025-01-27 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from datetime import datetime


# revision identifiers, used by Alembic.
revision = '015_add_create_tally_perm'
down_revision = '014_add_user_preferences'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Add can_create_tally_sessions permission and assign it to ADMIN role.
    This permission is specifically for creating new tally sessions.
    """
    now = datetime.utcnow()
    
    # Add the new permission
    op.execute(
        text(
            "INSERT INTO permissions (code, name, description, category, created_at) "
            "VALUES (:code, :name, :description, :category, :created_at)"
        ).bindparams(
            code='can_create_tally_sessions',
            name='Can Create Tally Sessions',
            description='Create new tally sessions',
            category='tally',
            created_at=now
        )
    )
    
    # Assign to ADMIN role (ADMIN gets all permissions except can_view_all_plants and can_assign_admin_roles)
    # This will be automatically assigned by migration 013's logic, but we explicitly add it here for clarity
    op.execute(
        text("""
            INSERT INTO role_permissions (role_id, permission_id, created_at)
            SELECT r.id, p.id, :created_at
            FROM roles r, permissions p
            WHERE r.name = 'ADMIN' 
            AND p.code = 'can_create_tally_sessions'
            AND NOT EXISTS (
                SELECT 1 FROM role_permissions rp2
                WHERE rp2.role_id = r.id AND rp2.permission_id = p.id
            )
        """).bindparams(created_at=now)
    )


def downgrade() -> None:
    """
    Remove can_create_tally_sessions permission and its role assignments.
    """
    # Remove from role_permissions first
    op.execute(
        text("""
            DELETE FROM role_permissions
            WHERE permission_id IN (
                SELECT id FROM permissions WHERE code = 'can_create_tally_sessions'
            )
        """)
    )
    
    # Remove the permission
    op.execute(
        text("DELETE FROM permissions WHERE code = 'can_create_tally_sessions'")
    )

