"""add_session_number_to_tally_sessions

Revision ID: 008_add_session_number_to_tally_sessions
Revises: 007_add_heads_columns
Create Date: 2025-01-15 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision = '008_add_session_number_to_tally_sessions'
down_revision = '007_add_heads_columns'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect_name = bind.dialect.name
    
    # Check if column already exists and its state (in case of partial migration)
    inspector = sa.inspect(bind)
    columns = {col['name']: col for col in inspector.get_columns('tally_sessions')}
    column_exists = 'session_number' in columns
    column_is_nullable = columns.get('session_number', {}).get('nullable', True) if column_exists else True
    
    # Add session_number column (nullable initially for backfill) if it doesn't exist
    if not column_exists:
        op.add_column('tally_sessions', sa.Column('session_number', sa.Integer(), nullable=True))
    
    # Backfill session_number for existing sessions (per customer) if column is nullable
    # This assigns sequential numbers starting from 1 for each customer
    if column_is_nullable:
        if dialect_name == 'sqlite':
            # SQLite doesn't support UPDATE with FROM, so we use a subquery approach
            # First, we need to update sessions one customer at a time
            # Get all unique customer_ids
            result = bind.execute(text("SELECT DISTINCT customer_id FROM tally_sessions ORDER BY customer_id"))
            customer_ids = [row[0] for row in result]
            
            for customer_id in customer_ids:
                # Update sessions for this customer with sequential numbers
                bind.execute(text("""
                    UPDATE tally_sessions
                    SET session_number = (
                        SELECT COUNT(*) + 1
                        FROM tally_sessions ts2
                        WHERE ts2.customer_id = :customer_id
                        AND (
                            ts2.created_at < tally_sessions.created_at
                            OR (ts2.created_at = tally_sessions.created_at AND ts2.id < tally_sessions.id)
                        )
                    )
                    WHERE customer_id = :customer_id
                """), {"customer_id": customer_id})
        else:
            # PostgreSQL and other databases support UPDATE with FROM
            op.execute("""
                WITH numbered_sessions AS (
                    SELECT 
                        id,
                        customer_id,
                        ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY created_at, id) as rn
                    FROM tally_sessions
                )
                UPDATE tally_sessions
                SET session_number = numbered_sessions.rn
                FROM numbered_sessions
                WHERE tally_sessions.id = numbered_sessions.id
            """)
    
    # Make session_number NOT NULL after backfill (only if it's still nullable)
    # SQLite doesn't support ALTER COLUMN, so we need to recreate the table
    if column_is_nullable:
        if dialect_name == 'sqlite':
            # Recreate table with session_number as NOT NULL
            op.create_table(
            'tally_sessions_new',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('customer_id', sa.Integer(), nullable=False),
            sa.Column('plant_id', sa.Integer(), nullable=False),
            sa.Column('date', sa.Date(), nullable=False),
            sa.Column('status', sa.String(50), nullable=False),
            sa.Column('session_number', sa.Integer(), nullable=False),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.current_timestamp(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.func.current_timestamp(), nullable=True),
            sa.ForeignKeyConstraint(['customer_id'], ['customers.id']),
            sa.ForeignKeyConstraint(['plant_id'], ['plants.id']),
            sa.PrimaryKeyConstraint('id'),
                sa.UniqueConstraint('customer_id', 'session_number', name='uq_tally_sessions_customer_session_number')
            )
            
            # Copy data from old table to new table
            op.execute("""
                INSERT INTO tally_sessions_new 
                (id, customer_id, plant_id, date, status, session_number, created_at, updated_at)
                SELECT id, customer_id, plant_id, date, status, session_number, created_at, updated_at
                FROM tally_sessions
            """)
            
            # Drop old table
            op.drop_table('tally_sessions')
            
            # Rename new table
            op.rename_table('tally_sessions_new', 'tally_sessions')
            
            # Recreate indexes
            op.create_index(op.f('ix_tally_sessions_id'), 'tally_sessions', ['id'], unique=False)
            op.create_index(op.f('ix_tally_sessions_customer_id'), 'tally_sessions', ['customer_id'], unique=False)
            op.create_index(op.f('ix_tally_sessions_plant_id'), 'tally_sessions', ['plant_id'], unique=False)
            op.create_index(op.f('ix_tally_sessions_date'), 'tally_sessions', ['date'], unique=False)
            op.create_index(op.f('ix_tally_sessions_status'), 'tally_sessions', ['status'], unique=False)
            op.create_index('idx_customer_plant_date', 'tally_sessions', ['customer_id', 'plant_id', 'date'], unique=False)
            op.create_index('idx_status_date', 'tally_sessions', ['status', 'date'], unique=False)
            op.create_index('idx_customer_session_number', 'tally_sessions', ['customer_id', 'session_number'], unique=False)
        else:
            # PostgreSQL and other databases: use ALTER COLUMN
            # SQL Server requires explicit type when altering NULL/NOT NULL
            if dialect_name == 'mssql':
                # SQL Server syntax: must specify type
                op.execute(text("ALTER TABLE tally_sessions ALTER COLUMN session_number INT NOT NULL"))
            else:
                # PostgreSQL and other databases
                op.alter_column('tally_sessions', 'session_number', 
                              existing_type=sa.Integer(), nullable=False)
            
            # Add unique constraint on (customer_id, session_number)
            op.create_unique_constraint(
                'uq_tally_sessions_customer_session_number',
                'tally_sessions',
                ['customer_id', 'session_number']
            )
            
            # Add index for faster lookups
            op.create_index(
                'idx_customer_session_number',
                'tally_sessions',
                ['customer_id', 'session_number']
            )
    
    # If column already exists and is NOT NULL, ensure constraints/indexes exist
    if column_exists and not column_is_nullable:
        # Column is already NOT NULL, just ensure constraints/indexes exist
        if dialect_name != 'sqlite':
            # For non-SQLite databases, check if constraint/index exist
            inspector = sa.inspect(bind)
            try:
                constraints = [c['name'] for c in inspector.get_unique_constraints('tally_sessions')]
                if 'uq_tally_sessions_customer_session_number' not in constraints:
                    op.create_unique_constraint(
                        'uq_tally_sessions_customer_session_number',
                        'tally_sessions',
                        ['customer_id', 'session_number']
                    )
            except Exception:
                pass  # Constraint might already exist
            
            try:
                indexes = [idx['name'] for idx in inspector.get_indexes('tally_sessions')]
                if 'idx_customer_session_number' not in indexes:
                    op.create_index(
                        'idx_customer_session_number',
                        'tally_sessions',
                        ['customer_id', 'session_number']
                    )
            except Exception:
                pass  # Index might already exist


def downgrade() -> None:
    bind = op.get_bind()
    dialect_name = bind.dialect.name
    
    if dialect_name == 'sqlite':
        # SQLite: recreate table without session_number
        op.create_table(
            'tally_sessions_new',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('customer_id', sa.Integer(), nullable=False),
            sa.Column('plant_id', sa.Integer(), nullable=False),
            sa.Column('date', sa.Date(), nullable=False),
            sa.Column('status', sa.String(50), nullable=False),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.current_timestamp(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.func.current_timestamp(), nullable=True),
            sa.ForeignKeyConstraint(['customer_id'], ['customers.id']),
            sa.ForeignKeyConstraint(['plant_id'], ['plants.id']),
            sa.PrimaryKeyConstraint('id')
        )
        
        # Copy data (excluding session_number)
        op.execute("""
            INSERT INTO tally_sessions_new 
            (id, customer_id, plant_id, date, status, created_at, updated_at)
            SELECT id, customer_id, plant_id, date, status, created_at, updated_at
            FROM tally_sessions
        """)
        
        # Drop old table
        op.drop_table('tally_sessions')
        
        # Rename new table
        op.rename_table('tally_sessions_new', 'tally_sessions')
        
        # Recreate indexes
        op.create_index(op.f('ix_tally_sessions_id'), 'tally_sessions', ['id'], unique=False)
        op.create_index(op.f('ix_tally_sessions_customer_id'), 'tally_sessions', ['customer_id'], unique=False)
        op.create_index(op.f('ix_tally_sessions_plant_id'), 'tally_sessions', ['plant_id'], unique=False)
        op.create_index(op.f('ix_tally_sessions_date'), 'tally_sessions', ['date'], unique=False)
        op.create_index(op.f('ix_tally_sessions_status'), 'tally_sessions', ['status'], unique=False)
        op.create_index('idx_customer_plant_date', 'tally_sessions', ['customer_id', 'plant_id', 'date'], unique=False)
        op.create_index('idx_status_date', 'tally_sessions', ['status', 'date'], unique=False)
    else:
        # Drop index
        op.drop_index('idx_customer_session_number', table_name='tally_sessions')
        
        # Drop unique constraint
        op.drop_constraint('uq_tally_sessions_customer_session_number', 'tally_sessions', type_='unique')
        
        # Drop column
        op.drop_column('tally_sessions', 'session_number')

