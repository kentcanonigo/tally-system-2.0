"""Initial migration

Revision ID: 001_initial
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '001_initial'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create customers table
    op.create_table(
        'customers',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.current_timestamp(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.current_timestamp(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_customers_id'), 'customers', ['id'], unique=False)
    op.create_index(op.f('ix_customers_name'), 'customers', ['name'], unique=False)

    # Create plants table
    op.create_table(
        'plants',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.current_timestamp(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.current_timestamp(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_plants_id'), 'plants', ['id'], unique=False)
    op.create_index(op.f('ix_plants_name'), 'plants', ['name'], unique=False)

    # Create weight_classifications table
    op.create_table(
        'weight_classifications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('plant_id', sa.Integer(), nullable=False),
        sa.Column('classification', sa.String(), nullable=False),
        sa.Column('min_weight', sa.Float(), nullable=False),
        sa.Column('max_weight', sa.Float(), nullable=False),
        sa.Column('category', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.current_timestamp(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.current_timestamp(), nullable=True),
        sa.ForeignKeyConstraint(['plant_id'], ['plants.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_weight_classifications_id'), 'weight_classifications', ['id'], unique=False)
    op.create_index(op.f('ix_weight_classifications_plant_id'), 'weight_classifications', ['plant_id'], unique=False)
    op.create_index('idx_plant_category', 'weight_classifications', ['plant_id', 'category'], unique=False)

    # Create tally_sessions table
    op.create_table(
        'tally_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('customer_id', sa.Integer(), nullable=False),
        sa.Column('plant_id', sa.Integer(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.current_timestamp(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.current_timestamp(), nullable=True),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ),
        sa.ForeignKeyConstraint(['plant_id'], ['plants.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_tally_sessions_id'), 'tally_sessions', ['id'], unique=False)
    op.create_index(op.f('ix_tally_sessions_customer_id'), 'tally_sessions', ['customer_id'], unique=False)
    op.create_index(op.f('ix_tally_sessions_plant_id'), 'tally_sessions', ['plant_id'], unique=False)
    op.create_index(op.f('ix_tally_sessions_date'), 'tally_sessions', ['date'], unique=False)
    op.create_index(op.f('ix_tally_sessions_status'), 'tally_sessions', ['status'], unique=False)
    op.create_index('idx_customer_plant_date', 'tally_sessions', ['customer_id', 'plant_id', 'date'], unique=False)
    op.create_index('idx_status_date', 'tally_sessions', ['status', 'date'], unique=False)

    # Create allocation_details table
    op.create_table(
        'allocation_details',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tally_session_id', sa.Integer(), nullable=False),
        sa.Column('weight_classification_id', sa.Integer(), nullable=False),
        sa.Column('required_bags', sa.Float(), nullable=False),
        sa.Column('allocated_bags', sa.Float(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.current_timestamp(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.current_timestamp(), nullable=True),
        sa.ForeignKeyConstraint(['tally_session_id'], ['tally_sessions.id'], ),
        sa.ForeignKeyConstraint(['weight_classification_id'], ['weight_classifications.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_allocation_details_id'), 'allocation_details', ['id'], unique=False)
    op.create_index(op.f('ix_allocation_details_tally_session_id'), 'allocation_details', ['tally_session_id'], unique=False)
    op.create_index(op.f('ix_allocation_details_weight_classification_id'), 'allocation_details', ['weight_classification_id'], unique=False)
    op.create_index('idx_session_classification', 'allocation_details', ['tally_session_id', 'weight_classification_id'], unique=True)


def downgrade() -> None:
    op.drop_index('idx_session_classification', table_name='allocation_details')
    op.drop_index(op.f('ix_allocation_details_weight_classification_id'), table_name='allocation_details')
    op.drop_index(op.f('ix_allocation_details_tally_session_id'), table_name='allocation_details')
    op.drop_index(op.f('ix_allocation_details_id'), table_name='allocation_details')
    op.drop_table('allocation_details')
    op.drop_index('idx_status_date', table_name='tally_sessions')
    op.drop_index('idx_customer_plant_date', table_name='tally_sessions')
    op.drop_index(op.f('ix_tally_sessions_status'), table_name='tally_sessions')
    op.drop_index(op.f('ix_tally_sessions_date'), table_name='tally_sessions')
    op.drop_index(op.f('ix_tally_sessions_plant_id'), table_name='tally_sessions')
    op.drop_index(op.f('ix_tally_sessions_customer_id'), table_name='tally_sessions')
    op.drop_index(op.f('ix_tally_sessions_id'), table_name='tally_sessions')
    op.drop_table('tally_sessions')
    op.drop_index('idx_plant_category', table_name='weight_classifications')
    op.drop_index(op.f('ix_weight_classifications_plant_id'), table_name='weight_classifications')
    op.drop_index(op.f('ix_weight_classifications_id'), table_name='weight_classifications')
    op.drop_table('weight_classifications')
    op.drop_index(op.f('ix_plants_name'), table_name='plants')
    op.drop_index(op.f('ix_plants_id'), table_name='plants')
    op.drop_table('plants')
    op.drop_index(op.f('ix_customers_name'), table_name='customers')
    op.drop_index(op.f('ix_customers_id'), table_name='customers')
    op.drop_table('customers')

