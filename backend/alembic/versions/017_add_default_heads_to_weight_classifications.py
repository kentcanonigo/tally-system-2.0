"""add default_heads to weight_classifications

Revision ID: 017_add_default_heads
Revises: 016_rename_permissions
Create Date: 2025-01-27 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '017_add_default_heads'
down_revision = '016_rename_permissions'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect_name = bind.dialect.name
    
    # Add default_heads column to weight_classifications table
    # Default to 15.0 for new entries, nullable=False with default
    op.add_column('weight_classifications', sa.Column('default_heads', sa.Float(), nullable=False, server_default='15.0'))
    
    # For SQLite, server_default might not work as expected, so we update existing rows
    if dialect_name == 'sqlite':
        # Update existing weight_classifications to have 15.0 default_heads if null
        op.execute("UPDATE weight_classifications SET default_heads = 15.0 WHERE default_heads IS NULL")


def downgrade() -> None:
    # Remove default_heads column
    op.drop_column('weight_classifications', 'default_heads')

