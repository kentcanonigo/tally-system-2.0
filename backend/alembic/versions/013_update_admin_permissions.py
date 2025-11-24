"""update_admin_permissions

Revision ID: 013_update_admin_permissions
Revises: 012_add_additional_permissions
Create Date: 2025-01-24 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from datetime import datetime


# revision identifiers, used by Alembic.
revision = '013_update_admin_permissions'
down_revision = '012_add_additional_permissions'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Grant ADMIN role all permissions except can_view_all_plants and can_assign_admin_roles.
    This is a correction to migration 012 which initially gave ADMIN only basic permissions.
    """
    now = datetime.utcnow()
    
    # Grant all remaining permissions to ADMIN except the two excluded ones
    # This will add permissions that weren't included in the initial migration
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
    Revert ADMIN role to only having the basic operational permissions.
    Remove the additional permissions granted in this migration.
    """
    # Remove the additional permissions, keeping only the original ones
    op.execute(
        text(
            "DELETE FROM role_permissions "
            "WHERE role_id = (SELECT id FROM roles WHERE name = 'ADMIN') "
            "AND permission_id IN ("
            "  SELECT id FROM permissions WHERE code IN ("
            "    'can_manage_users', 'can_delete_users', 'can_assign_basic_roles', "
            "    'can_manage_roles', 'can_delete_roles', 'can_assign_permissions', "
            "    'can_manage_plants', "
            "    'can_delete_tally_session', 'can_delete_tally_entries', "
            "    'can_manage_customers', 'can_manage_weight_classes'"
            "  )"
            ")"
        )
    )

