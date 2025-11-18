"""Create tally_log_entries table

Revision ID: 005_create_tally_log_entries
Revises: 1b0578615258
Create Date: 2025-01-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '005_create_tally_log_entries'
down_revision = '1b0578615258'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect_name = bind.dialect.name
    
    if dialect_name == 'sqlite':
        # SQLite: create table directly
        op.create_table(
            'tally_log_entries',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('tally_session_id', sa.Integer(), nullable=False),
            sa.Column('weight_classification_id', sa.Integer(), nullable=False),
            sa.Column('role', sa.String(20), nullable=False),
            sa.Column('weight', sa.Float(), nullable=False),
            sa.Column('notes', sa.String(500), nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.current_timestamp(), nullable=False),
            sa.ForeignKeyConstraint(['tally_session_id'], ['tally_sessions.id']),
            sa.ForeignKeyConstraint(['weight_classification_id'], ['weight_classifications.id']),
            sa.PrimaryKeyConstraint('id')
        )
        
        # Create indexes
        op.create_index(op.f('ix_tally_log_entries_id'), 'tally_log_entries', ['id'], unique=False)
        op.create_index(op.f('ix_tally_log_entries_tally_session_id'), 'tally_log_entries', ['tally_session_id'], unique=False)
        op.create_index(op.f('ix_tally_log_entries_weight_classification_id'), 'tally_log_entries', ['weight_classification_id'], unique=False)
        op.create_index(op.f('ix_tally_log_entries_role'), 'tally_log_entries', ['role'], unique=False)
        op.create_index(op.f('ix_tally_log_entries_created_at'), 'tally_log_entries', ['created_at'], unique=False)
        op.create_index('idx_session_role', 'tally_log_entries', ['tally_session_id', 'role'], unique=False)
        op.create_index('idx_session_created', 'tally_log_entries', ['tally_session_id', 'created_at'], unique=False)
        op.create_index('idx_classification', 'tally_log_entries', ['weight_classification_id'], unique=False)
    else:
        # Other databases: use ALTER TABLE approach
        op.create_table(
            'tally_log_entries',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('tally_session_id', sa.Integer(), nullable=False),
            sa.Column('weight_classification_id', sa.Integer(), nullable=False),
            sa.Column('role', sa.String(20), nullable=False),
            sa.Column('weight', sa.Float(), nullable=False),
            sa.Column('notes', sa.String(500), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(['tally_session_id'], ['tally_sessions.id']),
            sa.ForeignKeyConstraint(['weight_classification_id'], ['weight_classifications.id']),
            sa.PrimaryKeyConstraint('id')
        )
        
        # Create indexes
        op.create_index(op.f('ix_tally_log_entries_id'), 'tally_log_entries', ['id'], unique=False)
        op.create_index(op.f('ix_tally_log_entries_tally_session_id'), 'tally_log_entries', ['tally_session_id'], unique=False)
        op.create_index(op.f('ix_tally_log_entries_weight_classification_id'), 'tally_log_entries', ['weight_classification_id'], unique=False)
        op.create_index(op.f('ix_tally_log_entries_role'), 'tally_log_entries', ['role'], unique=False)
        op.create_index(op.f('ix_tally_log_entries_created_at'), 'tally_log_entries', ['created_at'], unique=False)
        op.create_index('idx_session_role', 'tally_log_entries', ['tally_session_id', 'role'], unique=False)
        op.create_index('idx_session_created', 'tally_log_entries', ['tally_session_id', 'created_at'], unique=False)
        op.create_index('idx_classification', 'tally_log_entries', ['weight_classification_id'], unique=False)


def downgrade() -> None:
    # Drop indexes first
    op.drop_index('idx_classification', table_name='tally_log_entries')
    op.drop_index('idx_session_created', table_name='tally_log_entries')
    op.drop_index('idx_session_role', table_name='tally_log_entries')
    op.drop_index(op.f('ix_tally_log_entries_created_at'), table_name='tally_log_entries')
    op.drop_index(op.f('ix_tally_log_entries_role'), table_name='tally_log_entries')
    op.drop_index(op.f('ix_tally_log_entries_weight_classification_id'), table_name='tally_log_entries')
    op.drop_index(op.f('ix_tally_log_entries_tally_session_id'), table_name='tally_log_entries')
    op.drop_index(op.f('ix_tally_log_entries_id'), table_name='tally_log_entries')
    
    # Drop table
    op.drop_table('tally_log_entries')

