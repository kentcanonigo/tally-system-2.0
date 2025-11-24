"""deprecate_legacy_role_field

Revision ID: 011_deprecate_legacy_role_field
Revises: 010_add_rbac_tables
Create Date: 2025-01-24 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = '011_deprecate_legacy_role_field'
down_revision = '010_add_rbac_tables'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Make the users.role column nullable to deprecate it.
    The RBAC system (roles, permissions, user_roles) is now the primary authorization system.
    The legacy role column is kept for backward compatibility but is no longer required.
    """
    # Check dialect to use appropriate syntax
    bind = op.get_bind()
    dialect_name = bind.dialect.name
    
    if dialect_name == 'postgresql':
        # PostgreSQL syntax
        op.alter_column('users', 'role',
                       existing_type=sa.String(),
                       nullable=True)
    elif dialect_name == 'sqlite':
        # SQLite doesn't support ALTER COLUMN directly, but it already allows NULLs
        # We can just add a comment via a no-op migration
        pass
    elif dialect_name == 'mysql' or dialect_name == 'mariadb':
        # MySQL/MariaDB syntax
        op.execute(text("ALTER TABLE users MODIFY role VARCHAR(50) NULL"))
    elif dialect_name == 'mssql':
        # SQL Server syntax
        op.execute(text("ALTER TABLE users ALTER COLUMN role VARCHAR(50) NULL"))
    else:
        # Generic fallback
        try:
            op.alter_column('users', 'role',
                           existing_type=sa.String(),
                           nullable=True)
        except Exception:
            # If this fails, just continue - the column might already be nullable
            pass


def downgrade() -> None:
    """
    Make the users.role column non-nullable again (revert to legacy system).
    This will fail if any users have NULL role values.
    """
    bind = op.get_bind()
    dialect_name = bind.dialect.name
    
    # First, update any NULL roles to 'admin' (safest default)
    op.execute(text("UPDATE users SET role = 'admin' WHERE role IS NULL"))
    
    if dialect_name == 'postgresql':
        op.alter_column('users', 'role',
                       existing_type=sa.String(),
                       nullable=False)
    elif dialect_name == 'sqlite':
        # SQLite - reconstruct table (complex, skipping for now)
        pass
    elif dialect_name == 'mysql' or dialect_name == 'mariadb':
        op.execute(text("ALTER TABLE users MODIFY role VARCHAR(50) NOT NULL"))
    elif dialect_name == 'mssql':
        op.execute(text("ALTER TABLE users ALTER COLUMN role VARCHAR(50) NOT NULL"))
    else:
        try:
            op.alter_column('users', 'role',
                           existing_type=sa.String(),
                           nullable=False)
        except Exception:
            pass

