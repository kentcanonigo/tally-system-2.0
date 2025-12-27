"""create tally_log_entry_audit table

Revision ID: 019_create_tally_log_entry_audit
Revises: 018_add_transfer_tracking
Create Date: 2025-01-28 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '019_create_tally_log_entry_audit'
down_revision = '018_add_transfer_tracking'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect_name = bind.dialect.name
    
    if dialect_name == 'sqlite':
        # SQLite: create table directly
        op.create_table(
            'tally_log_entry_audit',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('tally_log_entry_id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('edited_at', sa.DateTime(), server_default=sa.func.current_timestamp(), nullable=False),
            sa.Column('changes', sa.JSON(), nullable=False),
            sa.ForeignKeyConstraint(['tally_log_entry_id'], ['tally_log_entries.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['user_id'], ['users.id']),
            sa.PrimaryKeyConstraint('id')
        )
        
        # Create indexes
        op.create_index(op.f('ix_tally_log_entry_audit_id'), 'tally_log_entry_audit', ['id'], unique=False)
        op.create_index(op.f('ix_tally_log_entry_audit_tally_log_entry_id'), 'tally_log_entry_audit', ['tally_log_entry_id'], unique=False)
        op.create_index(op.f('ix_tally_log_entry_audit_user_id'), 'tally_log_entry_audit', ['user_id'], unique=False)
        op.create_index(op.f('ix_tally_log_entry_audit_edited_at'), 'tally_log_entry_audit', ['edited_at'], unique=False)
        op.create_index('idx_entry_edited_at', 'tally_log_entry_audit', ['tally_log_entry_id', 'edited_at'], unique=False)
    else:
        # Other databases: use timezone-aware timestamps
        op.create_table(
            'tally_log_entry_audit',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('tally_log_entry_id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('edited_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('changes', sa.JSON(), nullable=False),
            sa.ForeignKeyConstraint(['tally_log_entry_id'], ['tally_log_entries.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['user_id'], ['users.id']),
            sa.PrimaryKeyConstraint('id')
        )
        
        # Create indexes
        op.create_index(op.f('ix_tally_log_entry_audit_id'), 'tally_log_entry_audit', ['id'], unique=False)
        op.create_index(op.f('ix_tally_log_entry_audit_tally_log_entry_id'), 'tally_log_entry_audit', ['tally_log_entry_id'], unique=False)
        op.create_index(op.f('ix_tally_log_entry_audit_user_id'), 'tally_log_entry_audit', ['user_id'], unique=False)
        op.create_index(op.f('ix_tally_log_entry_audit_edited_at'), 'tally_log_entry_audit', ['edited_at'], unique=False)
        op.create_index('idx_entry_edited_at', 'tally_log_entry_audit', ['tally_log_entry_id', 'edited_at'], unique=False)


def downgrade() -> None:
    # Drop indexes first
    op.drop_index('idx_entry_edited_at', table_name='tally_log_entry_audit')
    op.drop_index(op.f('ix_tally_log_entry_audit_edited_at'), table_name='tally_log_entry_audit')
    op.drop_index(op.f('ix_tally_log_entry_audit_user_id'), table_name='tally_log_entry_audit')
    op.drop_index(op.f('ix_tally_log_entry_audit_tally_log_entry_id'), table_name='tally_log_entry_audit')
    op.drop_index(op.f('ix_tally_log_entry_audit_id'), table_name='tally_log_entry_audit')
    
    # Drop table
    op.drop_table('tally_log_entry_audit')

