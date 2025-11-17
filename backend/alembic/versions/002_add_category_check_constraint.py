"""Add category check constraint

Revision ID: 002_add_category_check
Revises: 001_initial
Create Date: 2024-01-02 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '002_add_category_check'
down_revision = '001_initial'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add CHECK constraint to enforce category values: 'Dressed' or 'Byproduct' only
    # Using raw SQL for SQL Server compatibility
    op.execute(
        "ALTER TABLE weight_classifications ADD CONSTRAINT ck_weight_classifications_category "
        "CHECK (category IN ('Dressed', 'Byproduct'))"
    )


def downgrade() -> None:
    # Remove the CHECK constraint
    op.execute("ALTER TABLE weight_classifications DROP CONSTRAINT ck_weight_classifications_category")

