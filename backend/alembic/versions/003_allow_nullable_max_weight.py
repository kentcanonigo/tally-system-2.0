"""Allow nullable max_weight for up ranges and catch-all

Revision ID: 003_nullable_max_weight
Revises: 002_add_category_check
Create Date: 2024-01-03 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '003_nullable_max_weight'
down_revision = '002_add_category_check'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Make max_weight nullable to support "up" ranges (no upper limit)
    # Also allow min_weight to be nullable for catch-all classifications
    op.alter_column('weight_classifications', 'max_weight',
                    existing_type=sa.Float(),
                    nullable=True)
    op.alter_column('weight_classifications', 'min_weight',
                    existing_type=sa.Float(),
                    nullable=True)
    
    # Add a check constraint to ensure at least one weight is set (not both null)
    # Catch-all must have both null, regular ranges must have min_weight set
    op.execute(
        "ALTER TABLE weight_classifications ADD CONSTRAINT ck_weight_classifications_weights "
        "CHECK ((min_weight IS NULL AND max_weight IS NULL) OR (min_weight IS NOT NULL))"
    )


def downgrade() -> None:
    # Remove the check constraint
    op.execute("ALTER TABLE weight_classifications DROP CONSTRAINT ck_weight_classifications_weights")
    
    # Set default values for null weights before making them non-nullable
    # This is a data migration - set null max_weights to a high value
    op.execute("UPDATE weight_classifications SET max_weight = 999999 WHERE max_weight IS NULL")
    op.execute("UPDATE weight_classifications SET min_weight = 0 WHERE min_weight IS NULL")
    
    # Make columns non-nullable again
    op.alter_column('weight_classifications', 'max_weight',
                    existing_type=sa.Float(),
                    nullable=False)
    op.alter_column('weight_classifications', 'min_weight',
                    existing_type=sa.Float(),
                    nullable=False)

