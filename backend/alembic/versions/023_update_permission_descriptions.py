"""update_permission_descriptions

Revision ID: 023_update_permission_descriptions
Revises: 022_add_tally_role_permissions
Create Date: 2025-01-29 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = '023_update_permission_descriptions'
down_revision = '022_add_tally_role_permissions'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Update permission descriptions to clearly distinguish between:
    - Allocation Details (requirements/plans for what needs to be tallied)
    - Tally Log Entries (individual work records of what was actually tallied)
    """
    
    # Update allocation-related permission descriptions
    op.execute(
        text(
            "UPDATE permissions SET description = 'Edit allocation details (requirements/plans for what needs to be tallied)' "
            "WHERE code = 'can_edit_tally_allocations'"
        )
    )
    
    op.execute(
        text(
            "UPDATE permissions SET description = 'Delete allocation details (removes requirements and all associated tally log entries)' "
            "WHERE code = 'can_delete_tally_allocations'"
        )
    )
    
    # Update tally log entry-related permission descriptions
    op.execute(
        text(
            "UPDATE permissions SET description = 'Edit individual tally log entries (work records of what was actually tallied)' "
            "WHERE code = 'can_edit_tally_log_entries'"
        )
    )
    
    op.execute(
        text(
            "UPDATE permissions SET description = 'Delete individual tally log entries (removes one work record, decrements allocation counts)' "
            "WHERE code = 'can_delete_tally_log_entries'"
        )
    )
    
    op.execute(
        text(
            "UPDATE permissions SET description = 'Transfer individual tally log entries between sessions (moves work records)' "
            "WHERE code = 'can_transfer_tally_log_entries'"
        )
    )


def downgrade() -> None:
    """
    Revert permission descriptions to their previous values.
    """
    # Revert allocation-related permissions
    op.execute(
        text(
            "UPDATE permissions SET description = 'Edit tally log entries' "
            "WHERE code = 'can_edit_tally_allocations'"
        )
    )
    
    op.execute(
        text(
            "UPDATE permissions SET description = 'Delete tally log entries' "
            "WHERE code = 'can_delete_tally_allocations'"
        )
    )
    
    # Revert tally log entry-related permissions
    op.execute(
        text(
            "UPDATE permissions SET description = 'Edit tally log entries' "
            "WHERE code = 'can_edit_tally_log_entries'"
        )
    )
    
    op.execute(
        text(
            "UPDATE permissions SET description = 'Delete tally log entries' "
            "WHERE code = 'can_delete_tally_log_entries'"
        )
    )
    
    op.execute(
        text(
            "UPDATE permissions SET description = 'Transfer tally log entries between sessions' "
            "WHERE code = 'can_transfer_tally_log_entries'"
        )
    )

