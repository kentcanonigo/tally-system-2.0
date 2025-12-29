"""add_tally_role_permissions

Revision ID: 022_add_tally_role_permissions
Revises: 021_add_tally_log_perms
Create Date: 2025-01-29 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from datetime import datetime


# revision identifiers, used by Alembic.
revision = '022_add_tally_role_permissions'
down_revision = '021_add_tally_log_perms'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Add two new permissions for controlling which role users can tally as:
    - can_tally_as_tallyer
    - can_tally_as_dispatcher
    """
    now = datetime.utcnow()
    
    # New permissions to add
    new_permissions = [
        {
            'code': 'can_tally_as_tallyer',
            'name': 'Can Tally as Tally-er',
            'description': 'Allows creating tally log entries as the Tally-er role',
            'category': 'tally'
        },
        {
            'code': 'can_tally_as_dispatcher',
            'name': 'Can Tally as Dispatcher',
            'description': 'Allows creating tally log entries as the Dispatcher role',
            'category': 'tally'
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
    
    # Assign ALL new permissions to SUPERADMIN role
    op.execute(
        text(
            "INSERT INTO role_permissions (role_id, permission_id, created_at) "
            "SELECT r.id, p.id, :created_at FROM roles r CROSS JOIN permissions p "
            "WHERE r.name = 'SUPERADMIN' "
            "AND p.code IN ('can_tally_as_tallyer', 'can_tally_as_dispatcher') "
            "AND NOT EXISTS ("
            "  SELECT 1 FROM role_permissions rp2 "
            "  WHERE rp2.role_id = r.id AND rp2.permission_id = p.id"
            ")"
        ).bindparams(created_at=now)
    )
    
    # Assign ALL new permissions to ADMIN role
    op.execute(
        text(
            "INSERT INTO role_permissions (role_id, permission_id, created_at) "
            "SELECT r.id, p.id, :created_at FROM roles r CROSS JOIN permissions p "
            "WHERE r.name = 'ADMIN' "
            "AND p.code IN ('can_tally_as_tallyer', 'can_tally_as_dispatcher') "
            "AND NOT EXISTS ("
            "  SELECT 1 FROM role_permissions rp2 "
            "  WHERE rp2.role_id = r.id AND rp2.permission_id = p.id"
            ")"
        ).bindparams(created_at=now)
    )


def downgrade() -> None:
    """
    Remove the tally role permissions added in this migration.
    """
    # Delete role_permissions entries for these permissions
    op.execute(
        text(
            "DELETE FROM role_permissions WHERE permission_id IN ("
            "  SELECT id FROM permissions WHERE code IN ("
            "    'can_tally_as_tallyer', 'can_tally_as_dispatcher'"
            "  )"
            ")"
        )
    )
    
    # Delete the permissions
    op.execute(
        text(
            "DELETE FROM permissions WHERE code IN ("
            "'can_tally_as_tallyer', 'can_tally_as_dispatcher'"
            ")"
        )
    )

