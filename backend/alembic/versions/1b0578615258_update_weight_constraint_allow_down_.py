"""update_weight_constraint_allow_down_ranges

Revision ID: 1b0578615258
Revises: 004_split_allocated_bags
Create Date: 2025-11-18 02:36:45.350835

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '1b0578615258'
down_revision = '004_split_allocated_bags'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Update the CHECK constraint to allow "down" ranges (min_weight NULL, max_weight NOT NULL)
    # Valid combinations:
    # 1. Both NULL (catch-all)
    # 2. min NOT NULL, max NULL (up range)
    # 3. min NULL, max NOT NULL (down range) - NEW
    # 4. Both NOT NULL, max >= min (regular range)
    bind = op.get_bind()
    dialect_name = bind.dialect.name
    
    if dialect_name == 'sqlite':
        # SQLite: recreate table with updated constraint
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
        # SQL Server and other databases: drop and recreate constraint
        op.execute("ALTER TABLE weight_classifications DROP CONSTRAINT ck_weight_classifications_weights")
        op.execute(
            "ALTER TABLE weight_classifications ADD CONSTRAINT ck_weight_classifications_weights "
            "CHECK ("
            "(min_weight IS NULL AND max_weight IS NULL) OR "
            "(min_weight IS NOT NULL AND max_weight IS NULL) OR "
            "(min_weight IS NULL AND max_weight IS NOT NULL) OR "
            "(min_weight IS NOT NULL AND max_weight IS NOT NULL AND max_weight >= min_weight)"
            ")"
        )


def downgrade() -> None:
    # Revert to previous constraint (no down ranges)
    bind = op.get_bind()
    dialect_name = bind.dialect.name
    
    if dialect_name == 'sqlite':
        # SQLite: recreate table with old constraint
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
            sa.CheckConstraint(
                "(min_weight IS NULL AND max_weight IS NULL) OR (min_weight IS NOT NULL)",
                name='ck_weight_classifications_weights'
            )
        )
        
        # Copy data (down ranges will be lost - set min_weight to 0)
        op.execute("""
            INSERT INTO weight_classifications_new 
            (id, plant_id, classification, min_weight, max_weight, category, created_at, updated_at)
            SELECT 
                id, plant_id, classification, 
                COALESCE(min_weight, 0) as min_weight,
                max_weight,
                category, created_at, updated_at
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
        op.execute("ALTER TABLE weight_classifications DROP CONSTRAINT ck_weight_classifications_weights")
        op.execute(
            "ALTER TABLE weight_classifications ADD CONSTRAINT ck_weight_classifications_weights "
            "CHECK ((min_weight IS NULL AND max_weight IS NULL) OR (min_weight IS NOT NULL))"
        )

