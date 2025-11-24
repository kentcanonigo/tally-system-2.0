"""add_rbac_tables

Revision ID: 010_add_rbac_tables
Revises: 009_add_authentication_tables
Create Date: 2025-01-24 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from datetime import datetime

# revision identifiers, used by Alembic.
revision = '010_add_rbac_tables'
down_revision = '009_add_authentication_tables'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect_name = bind.dialect.name
    
    # Create roles table
    op.create_table(
        'roles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_system', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_roles_id'), 'roles', ['id'], unique=False)
    op.create_index(op.f('ix_roles_name'), 'roles', ['name'], unique=True)
    
    # Create permissions table
    op.create_table(
        'permissions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(length=100), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('category', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_permissions_id'), 'permissions', ['id'], unique=False)
    op.create_index(op.f('ix_permissions_code'), 'permissions', ['code'], unique=True)
    
    # Create role_permissions table (many-to-many)
    op.create_table(
        'role_permissions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('role_id', sa.Integer(), nullable=False),
        sa.Column('permission_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['permission_id'], ['permissions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('role_id', 'permission_id', name='unique_role_permission')
    )
    op.create_index(op.f('ix_role_permissions_id'), 'role_permissions', ['id'], unique=False)
    op.create_index(op.f('ix_role_permissions_role_id'), 'role_permissions', ['role_id'], unique=False)
    op.create_index(op.f('ix_role_permissions_permission_id'), 'role_permissions', ['permission_id'], unique=False)
    
    # Create user_roles table (many-to-many)
    op.create_table(
        'user_roles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('role_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'role_id', name='unique_user_role')
    )
    op.create_index(op.f('ix_user_roles_id'), 'user_roles', ['id'], unique=False)
    op.create_index(op.f('ix_user_roles_user_id'), 'user_roles', ['user_id'], unique=False)
    op.create_index(op.f('ix_user_roles_role_id'), 'user_roles', ['role_id'], unique=False)
    
    # Seed data
    now = datetime.utcnow()
    
    # Insert permissions
    permissions_data = [
        {'code': 'can_start_tally', 'name': 'Can Start Tally', 'description': 'Allows starting and managing tally sessions', 'category': 'tally'},
        {'code': 'can_view_tally_logs', 'name': 'Can View Tally Logs', 'description': 'Allows viewing tally log entries and history', 'category': 'tally'},
        {'code': 'can_manage_weight_classes', 'name': 'Can Manage Weight Classes', 'description': 'Allows adding, editing, and deleting weight classifications', 'category': 'management'},
        {'code': 'can_manage_customers', 'name': 'Can Manage Customers', 'description': 'Allows adding, editing, and deleting customers', 'category': 'management'},
    ]
    
    for perm in permissions_data:
        op.execute(
            text(
                "INSERT INTO permissions (code, name, description, category, created_at) "
                "VALUES (:code, :name, :description, :category, :created_at)"
            ).bindparams(
                code=perm['code'],
                name=perm['name'],
                description=perm['description'],
                category=perm['category'],
                created_at=now
            )
        )
    
    # Insert system roles
    op.execute(
        text(
            "INSERT INTO roles (name, description, is_system, created_at, updated_at) "
            "VALUES (:name, :description, :is_system, :created_at, :updated_at)"
        ).bindparams(
            name='SUPERADMIN',
            description='System administrator with full access to all features and plants',
            is_system=True,
            created_at=now,
            updated_at=now
        )
    )
    
    op.execute(
        text(
            "INSERT INTO roles (name, description, is_system, created_at, updated_at) "
            "VALUES (:name, :description, :is_system, :created_at, :updated_at)"
        ).bindparams(
            name='ADMIN',
            description='Administrator with limited access based on assigned permissions',
            is_system=True,
            created_at=now,
            updated_at=now
        )
    )
    
    # Assign all permissions to SUPERADMIN role
    op.execute(
        text(
            "INSERT INTO role_permissions (role_id, permission_id, created_at) "
            "SELECT r.id, p.id, :created_at FROM roles r CROSS JOIN permissions p "
            "WHERE r.name = 'SUPERADMIN'"
        ).bindparams(created_at=now)
    )
    
    # Assign basic permissions to ADMIN role (can_start_tally, can_view_tally_logs)
    op.execute(
        text(
            "INSERT INTO role_permissions (role_id, permission_id, created_at) "
            "SELECT r.id, p.id, :created_at FROM roles r CROSS JOIN permissions p "
            "WHERE r.name = 'ADMIN' AND p.code IN ('can_start_tally', 'can_view_tally_logs')"
        ).bindparams(created_at=now)
    )
    
    # Migrate existing users to new role system
    # Users with role='SUPERADMIN' get SUPERADMIN role
    op.execute(
        text(
            "INSERT INTO user_roles (user_id, role_id, created_at) "
            "SELECT u.id, r.id, :created_at FROM users u CROSS JOIN roles r "
            "WHERE u.role = 'SUPERADMIN' AND r.name = 'SUPERADMIN'"
        ).bindparams(created_at=now)
    )
    
    # Users with role='ADMIN' get ADMIN role
    op.execute(
        text(
            "INSERT INTO user_roles (user_id, role_id, created_at) "
            "SELECT u.id, r.id, :created_at FROM users u CROSS JOIN roles r "
            "WHERE u.role = 'ADMIN' AND r.name = 'ADMIN'"
        ).bindparams(created_at=now)
    )


def downgrade() -> None:
    # Drop user_roles table
    op.drop_index(op.f('ix_user_roles_role_id'), table_name='user_roles')
    op.drop_index(op.f('ix_user_roles_user_id'), table_name='user_roles')
    op.drop_index(op.f('ix_user_roles_id'), table_name='user_roles')
    op.drop_table('user_roles')
    
    # Drop role_permissions table
    op.drop_index(op.f('ix_role_permissions_permission_id'), table_name='role_permissions')
    op.drop_index(op.f('ix_role_permissions_role_id'), table_name='role_permissions')
    op.drop_index(op.f('ix_role_permissions_id'), table_name='role_permissions')
    op.drop_table('role_permissions')
    
    # Drop permissions table
    op.drop_index(op.f('ix_permissions_code'), table_name='permissions')
    op.drop_index(op.f('ix_permissions_id'), table_name='permissions')
    op.drop_table('permissions')
    
    # Drop roles table
    op.drop_index(op.f('ix_roles_name'), table_name='roles')
    op.drop_index(op.f('ix_roles_id'), table_name='roles')
    op.drop_table('roles')

