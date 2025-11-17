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
    bind = op.get_bind()
    dialect_name = bind.dialect.name
    
    if dialect_name == 'sqlite':
        # SQLite: recreate table with nullable columns and constraint
        op.create_table(
            'weight_classifications_new',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('plant_id', sa.Integer(), nullable=False),
            sa.Column('classification', sa.String(255), nullable=False),
            sa.Column('min_weight', sa.Float(), nullable=True),
            sa.Column('max_weight', sa.Float(), nullable=True),
            sa.Column('category', sa.String(100), nullable=False),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.current_timestamp(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.func.current_timestamp(), nullable=True),
            sa.ForeignKeyConstraint(['plant_id'], ['plants.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.CheckConstraint("category IN ('Dressed', 'Byproduct')", name='ck_weight_classifications_category'),
            sa.CheckConstraint("(min_weight IS NULL AND max_weight IS NULL) OR (min_weight IS NOT NULL)", name='ck_weight_classifications_weights')
        )
        
        # Copy data
        op.execute("""
            INSERT INTO weight_classifications_new 
            (id, plant_id, classification, min_weight, max_weight, category, created_at, updated_at)
            SELECT id, plant_id, classification, min_weight, max_weight, category, created_at, updated_at
            FROM weight_classifications
        """)
        
        # Drop old table
        op.drop_table('weight_classifications')
        
        # Rename new table
        op.rename_table('weight_classifications_new', 'weight_classifications')
        
        # Recreate indexes
        op.create_index(op.f('ix_weight_classifications_id'), 'weight_classifications', ['id'], unique=False)
        op.create_index(op.f('ix_weight_classifications_plant_id'), 'weight_classifications', ['plant_id'], unique=False)
        op.create_index('idx_plant_category', 'weight_classifications', ['plant_id', 'category'], unique=False)
    else:
        # SQL Server and other databases: use ALTER TABLE
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
    bind = op.get_bind()
    dialect_name = bind.dialect.name
    
    if dialect_name == 'sqlite':
        # SQLite: recreate table with non-nullable columns
        # First, update data to set nulls to defaults
        op.execute("UPDATE weight_classifications SET max_weight = 999999 WHERE max_weight IS NULL")
        op.execute("UPDATE weight_classifications SET min_weight = 0 WHERE min_weight IS NULL")
        
        # Recreate table without nullable columns
        op.create_table(
            'weight_classifications_new',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('plant_id', sa.Integer(), nullable=False),
            sa.Column('classification', sa.String(255), nullable=False),
            sa.Column('min_weight', sa.Float(), nullable=False),
            sa.Column('max_weight', sa.Float(), nullable=False),
            sa.Column('category', sa.String(100), nullable=False),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.current_timestamp(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.func.current_timestamp(), nullable=True),
            sa.ForeignKeyConstraint(['plant_id'], ['plants.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.CheckConstraint("category IN ('Dressed', 'Byproduct')", name='ck_weight_classifications_category')
        )
        
        # Copy data
        op.execute("""
            INSERT INTO weight_classifications_new 
            (id, plant_id, classification, min_weight, max_weight, category, created_at, updated_at)
            SELECT id, plant_id, classification, min_weight, max_weight, category, created_at, updated_at
            FROM weight_classifications
        """)
        
        # Drop old table
        op.drop_table('weight_classifications')
        
        # Rename new table
        op.rename_table('weight_classifications_new', 'weight_classifications')
        
        # Recreate indexes
        op.create_index(op.f('ix_weight_classifications_id'), 'weight_classifications', ['id'], unique=False)
        op.create_index(op.f('ix_weight_classifications_plant_id'), 'weight_classifications', ['plant_id'], unique=False)
        op.create_index('idx_plant_category', 'weight_classifications', ['plant_id', 'category'], unique=False)
    else:
        # SQL Server and other databases: use ALTER TABLE
        # Remove the check constraint
        op.execute("ALTER TABLE weight_classifications DROP CONSTRAINT ck_weight_classifications_weights")
        
        # Set default values for null weights before making them non-nullable
        op.execute("UPDATE weight_classifications SET max_weight = 999999 WHERE max_weight IS NULL")
        op.execute("UPDATE weight_classifications SET min_weight = 0 WHERE min_weight IS NULL")
        
        # Make columns non-nullable again
        op.alter_column('weight_classifications', 'max_weight',
                        existing_type=sa.Float(),
                        nullable=False)
        op.alter_column('weight_classifications', 'min_weight',
                        existing_type=sa.Float(),
                        nullable=False)

