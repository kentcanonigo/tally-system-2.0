"""add_tally_log_entry_permissions

Revision ID: 021_add_tally_log_entry_permissions
Revises: 020_add_frozen_category
Create Date: 2025-01-29 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from datetime import datetime


# revision identifiers, used by Alembic.
revision = '021_add_tally_log_entry_permissions'
down_revision = '020_add_frozen_category'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Add three new permissions for tally log entry operations:
    - can_edit_tally_log_entries
    - can_delete_tally_log_entries
    - can_transfer_tally_log_entries
    """
    now = datetime.utcnow()
    
    # New permissions to add
    new_permissions = [
        {
            'code': 'can_edit_tally_log_entries',
            'name': 'Can Edit Tally Log Entries',
            'description': 'Edit tally log entries',
            'category': 'tally'
        },
        {
            'code': 'can_delete_tally_log_entries',
            'name': 'Can Delete Tally Log Entries',
            'description': 'Delete tally log entries',
            'category': 'tally'
        },
        {
            'code': 'can_transfer_tally_log_entries',
            'name': 'Can Transfer Tally Log Entries',
            'description': 'Transfer tally log entries between sessions',
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
            "AND p.code IN ('can_edit_tally_log_entries', 'can_delete_tally_log_entries', 'can_transfer_tally_log_entries') "
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
            "AND p.code IN ('can_edit_tally_log_entries', 'can_delete_tally_log_entries', 'can_transfer_tally_log_entries') "
            "AND NOT EXISTS ("
            "  SELECT 1 FROM role_permissions rp2 "
            "  WHERE rp2.role_id = r.id AND rp2.permission_id = p.id"
            ")"
        ).bindparams(created_at=now)
    )


def downgrade() -> None:
    """
    Remove the tally log entry permissions added in this migration.
    """
    # Delete role_permissions entries for these permissions
    op.execute(
        text(
            "DELETE FROM role_permissions WHERE permission_id IN ("
            "  SELECT id FROM permissions WHERE code IN ("
            "    'can_edit_tally_log_entries', 'can_delete_tally_log_entries', 'can_transfer_tally_log_entries'"
            "  )"
            ")"
        )
    )
    
    # Delete the permissions
    op.execute(
        text(
            "DELETE FROM permissions WHERE code IN ("
            "'can_edit_tally_log_entries', 'can_delete_tally_log_entries', 'can_transfer_tally_log_entries'"
            ")"
        )
    )

