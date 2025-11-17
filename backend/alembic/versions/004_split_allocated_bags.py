"""Split allocated_bags into allocated_bags_tally and allocated_bags_dispatcher

Revision ID: 004_split_allocated_bags
Revises: 003_nullable_max_weight
Create Date: 2024-01-04 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '004_split_allocated_bags'
down_revision = '003_nullable_max_weight'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new columns for tally and dispatcher allocated bags
    bind = op.get_bind()
    dialect_name = bind.dialect.name
    
    if dialect_name == 'sqlite':
        # SQLite: recreate table with new columns
        op.create_table(
            'allocation_details_new',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('tally_session_id', sa.Integer(), nullable=False),
            sa.Column('weight_classification_id', sa.Integer(), nullable=False),
            sa.Column('required_bags', sa.Float(), nullable=False),
            sa.Column('allocated_bags_tally', sa.Float(), nullable=False),
            sa.Column('allocated_bags_dispatcher', sa.Float(), nullable=False),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.current_timestamp(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.func.current_timestamp(), nullable=True),
            sa.ForeignKeyConstraint(['tally_session_id'], ['tally_sessions.id']),
            sa.ForeignKeyConstraint(['weight_classification_id'], ['weight_classifications.id']),
            sa.PrimaryKeyConstraint('id')
        )
        
        # Copy data: use allocated_bags for both new fields
        op.execute("""
            INSERT INTO allocation_details_new 
            (id, tally_session_id, weight_classification_id, required_bags, allocated_bags_tally, allocated_bags_dispatcher, created_at, updated_at)
            SELECT id, tally_session_id, weight_classification_id, required_bags, allocated_bags, allocated_bags, created_at, updated_at
            FROM allocation_details
        """)
        
        # Drop old table
        op.drop_table('allocation_details')
        
        # Rename new table
        op.rename_table('allocation_details_new', 'allocation_details')
        
        # Recreate indexes
        op.create_index(op.f('ix_allocation_details_id'), 'allocation_details', ['id'], unique=False)
        op.create_index(op.f('ix_allocation_details_tally_session_id'), 'allocation_details', ['tally_session_id'], unique=False)
        op.create_index(op.f('ix_allocation_details_weight_classification_id'), 'allocation_details', ['weight_classification_id'], unique=False)
        op.create_index('idx_session_classification', 'allocation_details', ['tally_session_id', 'weight_classification_id'], unique=True)
    else:
        # SQL Server and other databases: use ALTER TABLE
        op.add_column('allocation_details', sa.Column('allocated_bags_tally', sa.Float(), nullable=True))
        op.add_column('allocation_details', sa.Column('allocated_bags_dispatcher', sa.Float(), nullable=True))
        
        # Migrate existing data: copy allocated_bags to both new fields
        op.execute("UPDATE allocation_details SET allocated_bags_tally = allocated_bags")
        op.execute("UPDATE allocation_details SET allocated_bags_dispatcher = allocated_bags")
        
        # Make the new columns non-nullable
        op.alter_column('allocation_details', 'allocated_bags_tally', nullable=False, server_default='0.0')
        op.alter_column('allocation_details', 'allocated_bags_dispatcher', nullable=False, server_default='0.0')
        
        # Remove the server default (we only needed it for the migration)
        op.alter_column('allocation_details', 'allocated_bags_tally', server_default=None)
        op.alter_column('allocation_details', 'allocated_bags_dispatcher', server_default=None)
        
        # Drop the old allocated_bags column
        op.drop_column('allocation_details', 'allocated_bags')


def downgrade() -> None:
    bind = op.get_bind()
    dialect_name = bind.dialect.name
    
    if dialect_name == 'sqlite':
        # SQLite: recreate table with old column
        op.create_table(
            'allocation_details_new',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('tally_session_id', sa.Integer(), nullable=False),
            sa.Column('weight_classification_id', sa.Integer(), nullable=False),
            sa.Column('required_bags', sa.Float(), nullable=False),
            sa.Column('allocated_bags', sa.Float(), nullable=False),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.current_timestamp(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.func.current_timestamp(), nullable=True),
            sa.ForeignKeyConstraint(['tally_session_id'], ['tally_sessions.id']),
            sa.ForeignKeyConstraint(['weight_classification_id'], ['weight_classifications.id']),
            sa.PrimaryKeyConstraint('id')
        )
        
        # Copy data: use tally value for allocated_bags
        op.execute("""
            INSERT INTO allocation_details_new 
            (id, tally_session_id, weight_classification_id, required_bags, allocated_bags, created_at, updated_at)
            SELECT id, tally_session_id, weight_classification_id, required_bags, allocated_bags_tally, created_at, updated_at
            FROM allocation_details
        """)
        
        # Drop old table
        op.drop_table('allocation_details')
        
        # Rename new table
        op.rename_table('allocation_details_new', 'allocation_details')
        
        # Recreate indexes
        op.create_index(op.f('ix_allocation_details_id'), 'allocation_details', ['id'], unique=False)
        op.create_index(op.f('ix_allocation_details_tally_session_id'), 'allocation_details', ['tally_session_id'], unique=False)
        op.create_index(op.f('ix_allocation_details_weight_classification_id'), 'allocation_details', ['weight_classification_id'], unique=False)
        op.create_index('idx_session_classification', 'allocation_details', ['tally_session_id', 'weight_classification_id'], unique=True)
    else:
        # SQL Server and other databases: use ALTER TABLE
        # Add back the old allocated_bags column
        op.add_column('allocation_details', sa.Column('allocated_bags', sa.Float(), nullable=True))
        
        # Migrate data back: use tally value
        op.execute("UPDATE allocation_details SET allocated_bags = COALESCE(allocated_bags_tally, 0.0)")
        
        # Make it non-nullable
        op.alter_column('allocation_details', 'allocated_bags', nullable=False, server_default='0.0')
        op.alter_column('allocation_details', 'allocated_bags', server_default=None)
        
        # Drop the new columns
        op.drop_column('allocation_details', 'allocated_bags_dispatcher')
        op.drop_column('allocation_details', 'allocated_bags_tally')

