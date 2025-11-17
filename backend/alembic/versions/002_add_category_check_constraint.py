"""Add category check constraint

Revision ID: 002_add_category_check
Revises: 001_initial
Create Date: 2024-01-02 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = '002_add_category_check'
down_revision = '001_initial'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add CHECK constraint to enforce category values: 'Dressed' or 'Byproduct' only
    # SQLite doesn't support ALTER TABLE ADD CONSTRAINT, so we need to recreate the table
    bind = op.get_bind()
    dialect_name = bind.dialect.name
    
    if dialect_name == 'sqlite':
        # SQLite: recreate table with constraint
        # Create new table with constraint
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
        op.execute(
            "ALTER TABLE weight_classifications ADD CONSTRAINT ck_weight_classifications_category "
            "CHECK (category IN ('Dressed', 'Byproduct'))"
        )


def downgrade() -> None:
    # Remove the CHECK constraint
    bind = op.get_bind()
    dialect_name = bind.dialect.name
    
    if dialect_name == 'sqlite':
        # SQLite: recreate table without constraint
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
            sa.PrimaryKeyConstraint('id')
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
        op.execute("ALTER TABLE weight_classifications DROP CONSTRAINT ck_weight_classifications_category")

