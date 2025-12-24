"""add transfer tracking to tally_log_entries

Revision ID: 018_add_transfer_tracking
Revises: 017_add_default_heads
Create Date: 2025-01-27 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '018_add_transfer_tracking'
down_revision = '017_add_default_heads'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect_name = bind.dialect.name
    
    if dialect_name == 'sqlite':
        # SQLite requires batch mode for adding foreign keys
        with op.batch_alter_table('tally_log_entries', schema=None) as batch_op:
            # Add original_session_id column (nullable, foreign key to tally_sessions)
            batch_op.add_column(sa.Column('original_session_id', sa.Integer(), nullable=True))
            batch_op.create_foreign_key(
                'fk_tally_log_entries_original_session_id',
                'tally_sessions',
                ['original_session_id'],
                ['id']
            )
            batch_op.create_index(
                op.f('ix_tally_log_entries_original_session_id'),
                ['original_session_id'],
                unique=False
            )
            
            # Add transferred_at column (nullable, timestamp)
            batch_op.add_column(sa.Column('transferred_at', sa.DateTime(), nullable=True))
            batch_op.create_index(
                op.f('ix_tally_log_entries_transferred_at'),
                ['transferred_at'],
                unique=False
            )
    else:
        # For other databases, use standard operations
        # Add original_session_id column (nullable, foreign key to tally_sessions)
        op.add_column('tally_log_entries', sa.Column('original_session_id', sa.Integer(), nullable=True))
        op.create_foreign_key(
            'fk_tally_log_entries_original_session_id',
            'tally_log_entries',
            'tally_sessions',
            ['original_session_id'],
            ['id']
        )
        op.create_index(
            op.f('ix_tally_log_entries_original_session_id'),
            'tally_log_entries',
            ['original_session_id'],
            unique=False
        )
        
        # Add transferred_at column (nullable, timestamp)
        op.add_column('tally_log_entries', sa.Column('transferred_at', sa.DateTime(timezone=True), nullable=True))
        op.create_index(
            op.f('ix_tally_log_entries_transferred_at'),
            'tally_log_entries',
            ['transferred_at'],
            unique=False
        )


def downgrade() -> None:
    bind = op.get_bind()
    dialect_name = bind.dialect.name
    
    if dialect_name == 'sqlite':
        # SQLite requires batch mode for dropping foreign keys
        with op.batch_alter_table('tally_log_entries', schema=None) as batch_op:
            # Drop indexes first
            batch_op.drop_index(op.f('ix_tally_log_entries_transferred_at'))
            batch_op.drop_index(op.f('ix_tally_log_entries_original_session_id'))
            
            # Drop foreign key constraint
            batch_op.drop_constraint('fk_tally_log_entries_original_session_id', type_='foreignkey')
            
            # Drop columns
            batch_op.drop_column('transferred_at')
            batch_op.drop_column('original_session_id')
    else:
        # For other databases, use standard operations
        # Drop indexes first
        op.drop_index(op.f('ix_tally_log_entries_transferred_at'), table_name='tally_log_entries')
        op.drop_index(op.f('ix_tally_log_entries_original_session_id'), table_name='tally_log_entries')
        
        # Drop foreign key constraint
        op.drop_constraint('fk_tally_log_entries_original_session_id', 'tally_log_entries', type_='foreignkey')
        
        # Drop columns
        op.drop_column('tally_log_entries', 'transferred_at')
        op.drop_column('tally_log_entries', 'original_session_id')

