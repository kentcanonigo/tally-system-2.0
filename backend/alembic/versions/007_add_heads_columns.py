"""add heads columns to tally_log_entries and allocation_details

Revision ID: 007_add_heads_columns
Revises: 006_add_weight_class_desc
Create Date: 2025-01-15 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '007_add_heads_columns'
down_revision = '006_add_weight_class_desc'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect_name = bind.dialect.name
    
    # Add heads column to tally_log_entries table
    # Default to 15.0 for new entries, nullable for backward compatibility
    op.add_column('tally_log_entries', sa.Column('heads', sa.Float(), nullable=True, server_default='15.0'))
    
    # Add heads column to allocation_details table
    # Default to 0.0, nullable for backward compatibility
    op.add_column('allocation_details', sa.Column('heads', sa.Float(), nullable=True, server_default='0.0'))
    
    # For SQLite, server_default might not work as expected, so we update existing rows
    if dialect_name == 'sqlite':
        # Update existing tally_log_entries to have 15.0 heads if null
        op.execute("UPDATE tally_log_entries SET heads = 15.0 WHERE heads IS NULL")
        # Update existing allocation_details to have 0.0 heads if null
        op.execute("UPDATE allocation_details SET heads = 0.0 WHERE heads IS NULL")


def downgrade() -> None:
    # Remove heads columns
    op.drop_column('allocation_details', 'heads')
    op.drop_column('tally_log_entries', 'heads')

