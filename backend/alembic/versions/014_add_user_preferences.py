"""add user preferences

Revision ID: 014_add_user_preferences
Revises: 013_update_admin_permissions
Create Date: 2025-11-24

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '014_add_user_preferences'
down_revision = '013_update_admin_permissions'
branch_labels = None
depends_on = None


def upgrade():
    # Add user preference columns
    op.add_column('users', sa.Column('timezone', sa.String(100), nullable=True, server_default='UTC'))
    op.add_column('users', sa.Column('active_plant_id', sa.Integer(), nullable=True))
    op.add_column('users', sa.Column('acceptable_difference_threshold', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('visible_tabs', sa.JSON(), nullable=True))


def downgrade():
    # Remove user preference columns
    op.drop_column('users', 'visible_tabs')
    op.drop_column('users', 'acceptable_difference_threshold')
    op.drop_column('users', 'active_plant_id')
    op.drop_column('users', 'timezone')

