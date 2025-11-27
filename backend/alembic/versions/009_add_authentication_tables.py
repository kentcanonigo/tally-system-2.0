"""add_authentication_tables

Revision ID: 009_add_authentication_tables
Revises: 008_add_session_number
Create Date: 2025-01-20 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision = '009_add_authentication_tables'
down_revision = '008_add_session_number'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect_name = bind.dialect.name
    
    # Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('username', sa.String(length=255), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('role', sa.Enum('SUPERADMIN', 'ADMIN', name='userrole'), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for users table
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)
    op.create_index(op.f('ix_users_username'), 'users', ['username'], unique=True)
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    
    # Create plant_permissions table
    op.create_table(
        'plant_permissions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('plant_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['plant_id'], ['plants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'plant_id', name='unique_user_plant')
    )
    
    # Create indexes for plant_permissions table
    op.create_index(op.f('ix_plant_permissions_id'), 'plant_permissions', ['id'], unique=False)
    op.create_index(op.f('ix_plant_permissions_user_id'), 'plant_permissions', ['user_id'], unique=False)
    op.create_index(op.f('ix_plant_permissions_plant_id'), 'plant_permissions', ['plant_id'], unique=False)


def downgrade() -> None:
    # Drop plant_permissions table
    op.drop_index(op.f('ix_plant_permissions_plant_id'), table_name='plant_permissions')
    op.drop_index(op.f('ix_plant_permissions_user_id'), table_name='plant_permissions')
    op.drop_index(op.f('ix_plant_permissions_id'), table_name='plant_permissions')
    op.drop_table('plant_permissions')
    
    # Drop users table
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_index(op.f('ix_users_username'), table_name='users')
    op.drop_index(op.f('ix_users_id'), table_name='users')
    op.drop_table('users')
    
    # Drop enum type (for PostgreSQL/SQL Server compatibility)
    bind = op.get_bind()
    dialect_name = bind.dialect.name
    if dialect_name == 'postgresql':
        op.execute('DROP TYPE userrole')

