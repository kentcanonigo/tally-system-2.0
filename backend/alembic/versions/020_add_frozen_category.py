"""Add Frozen category to weight_classifications

Revision ID: 020_add_frozen_category
Revises: 019_create_tally_log_entry_audit
Create Date: 2025-01-29 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '020_add_frozen_category'
down_revision = '019_create_tally_log_entry_audit'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Update CHECK constraint to allow 'Frozen' category
    # SQLite doesn't support ALTER TABLE DROP/ADD CONSTRAINT, so we need to recreate the table
    bind = op.get_bind()
    dialect_name = bind.dialect.name
    
    if dialect_name == 'sqlite':
        # SQLite: recreate table with updated constraint
        op.create_table(
            'weight_classifications_new',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('plant_id', sa.Integer(), nullable=False),
            sa.Column('classification', sa.String(255), nullable=False),
            sa.Column('description', sa.String(500), nullable=True),
            sa.Column('min_weight', sa.Float(), nullable=True),
            sa.Column('max_weight', sa.Float(), nullable=True),
            sa.Column('category', sa.String(100), nullable=False),
            sa.Column('default_heads', sa.Float(), nullable=False, server_default='15.0'),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.current_timestamp(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.func.current_timestamp(), nullable=True),
            sa.ForeignKeyConstraint(['plant_id'], ['plants.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.CheckConstraint("category IN ('Dressed', 'Byproduct', 'Frozen')", name='ck_weight_classifications_category'),
            sa.CheckConstraint(
                "(min_weight IS NULL AND max_weight IS NULL) OR "
                "(min_weight IS NOT NULL AND max_weight IS NULL) OR "
                "(min_weight IS NULL AND max_weight IS NOT NULL) OR "
                "(min_weight IS NOT NULL AND max_weight IS NOT NULL AND max_weight >= min_weight)",
                name='ck_weight_classifications_weights'
            )
        )
        
        # Copy data
        op.execute("""
            INSERT INTO weight_classifications_new 
            (id, plant_id, classification, description, min_weight, max_weight, category, default_heads, created_at, updated_at)
            SELECT id, plant_id, classification, description, min_weight, max_weight, category, default_heads, created_at, updated_at
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
        # SQL Server and other databases: drop and recreate constraint
        # First, check if the constraint exists and drop it
        op.execute("""
            IF EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'ck_weight_classifications_category')
            BEGIN
                ALTER TABLE weight_classifications DROP CONSTRAINT ck_weight_classifications_category
            END
        """)
        
        # Add updated constraint
        op.execute(
            "ALTER TABLE weight_classifications ADD CONSTRAINT ck_weight_classifications_category "
            "CHECK (category IN ('Dressed', 'Byproduct', 'Frozen'))"
        )


def downgrade() -> None:
    # Revert to previous constraint (remove Frozen)
    bind = op.get_bind()
    dialect_name = bind.dialect.name
    
    if dialect_name == 'sqlite':
        # SQLite: recreate table with old constraint
        op.create_table(
            'weight_classifications_new',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('plant_id', sa.Integer(), nullable=False),
            sa.Column('classification', sa.String(255), nullable=False),
            sa.Column('description', sa.String(500), nullable=True),
            sa.Column('min_weight', sa.Float(), nullable=True),
            sa.Column('max_weight', sa.Float(), nullable=True),
            sa.Column('category', sa.String(100), nullable=False),
            sa.Column('default_heads', sa.Float(), nullable=False, server_default='15.0'),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.current_timestamp(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.func.current_timestamp(), nullable=True),
            sa.ForeignKeyConstraint(['plant_id'], ['plants.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.CheckConstraint("category IN ('Dressed', 'Byproduct')", name='ck_weight_classifications_category'),
            sa.CheckConstraint(
                "(min_weight IS NULL AND max_weight IS NULL) OR "
                "(min_weight IS NOT NULL AND max_weight IS NULL) OR "
                "(min_weight IS NULL AND max_weight IS NOT NULL) OR "
                "(min_weight IS NOT NULL AND max_weight IS NOT NULL AND max_weight >= min_weight)",
                name='ck_weight_classifications_weights'
            )
        )
        
        # Copy data (Frozen classifications will be lost)
        op.execute("""
            INSERT INTO weight_classifications_new 
            (id, plant_id, classification, description, min_weight, max_weight, category, default_heads, created_at, updated_at)
            SELECT id, plant_id, classification, description, min_weight, max_weight, category, default_heads, created_at, updated_at
            FROM weight_classifications
            WHERE category IN ('Dressed', 'Byproduct')
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
        # SQL Server and other databases: drop and recreate constraint
        op.execute("""
            IF EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'ck_weight_classifications_category')
            BEGIN
                ALTER TABLE weight_classifications DROP CONSTRAINT ck_weight_classifications_category
            END
        """)
        
        # Delete any Frozen classifications before adding constraint
        op.execute("DELETE FROM weight_classifications WHERE category = 'Frozen'")
        
        # Add old constraint
        op.execute(
            "ALTER TABLE weight_classifications ADD CONSTRAINT ck_weight_classifications_category "
            "CHECK (category IN ('Dressed', 'Byproduct'))"
        )

