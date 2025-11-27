"""rename_permissions

Revision ID: 016_rename_permissions
Revises: 015_add_create_tally_sessions_permission
Create Date: 2025-01-27 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = '016_rename_permissions'
down_revision = '015_add_create_tally_sessions_permission'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Rename permissions for clarity:
    - can_start_tally -> can_tally
    - can_edit_tally_entries -> can_edit_tally_allocations
    - can_delete_tally_entries -> can_delete_tally_allocations
    """
    # Rename can_start_tally to can_tally
    op.execute(
        text("UPDATE permissions SET code = 'can_tally' WHERE code = 'can_start_tally'")
    )
    
    # Rename can_edit_tally_entries to can_edit_tally_allocations
    op.execute(
        text("UPDATE permissions SET code = 'can_edit_tally_allocations' WHERE code = 'can_edit_tally_entries'")
    )
    
    # Rename can_delete_tally_entries to can_delete_tally_allocations
    op.execute(
        text("UPDATE permissions SET code = 'can_delete_tally_allocations' WHERE code = 'can_delete_tally_entries'")
    )


def downgrade() -> None:
    """
    Revert permission name changes.
    """
    # Revert can_tally to can_start_tally
    op.execute(
        text("UPDATE permissions SET code = 'can_start_tally' WHERE code = 'can_tally'")
    )
    
    # Revert can_edit_tally_allocations to can_edit_tally_entries
    op.execute(
        text("UPDATE permissions SET code = 'can_edit_tally_entries' WHERE code = 'can_edit_tally_allocations'")
    )
    
    # Revert can_delete_tally_allocations to can_delete_tally_entries
    op.execute(
        text("UPDATE permissions SET code = 'can_delete_tally_entries' WHERE code = 'can_delete_tally_allocations'")
    )

