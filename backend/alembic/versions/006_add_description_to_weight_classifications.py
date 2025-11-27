"""add description to weight classifications

Revision ID: 006_add_weight_class_desc
Revises: 005_create_tally_log_entries
Create Date: 2025-01-15 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '006_add_weight_class_desc'
down_revision = '005_create_tally_log_entries'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add description column to weight_classifications table
    op.add_column('weight_classifications', sa.Column('description', sa.String(500), nullable=True))


def downgrade() -> None:
    # Remove description column
    op.drop_column('weight_classifications', 'description')

