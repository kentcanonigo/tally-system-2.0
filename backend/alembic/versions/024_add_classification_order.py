"""add classification_order to user preferences

Revision ID: 024_add_classification_order
Revises: 023_update_perm_descriptions
Create Date: 2025-01-29 17:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '024_add_classification_order'
down_revision = '023_update_perm_descriptions'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add classification_order column to users table
    op.add_column('users', sa.Column('classification_order', sa.JSON(), nullable=True))


def downgrade() -> None:
    # Remove classification_order column
    op.drop_column('users', 'classification_order')
