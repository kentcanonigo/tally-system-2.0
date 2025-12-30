#!/usr/bin/env python3
"""
Quick script to check the current Alembic version in the database.
Usage: python backend/check_alembic_version.py
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy import create_engine, text
from app.config import settings

def check_alembic_version():
    """Check the current Alembic version in the database."""
    try:
        print(f"Connecting to database: {settings.database_url.split('@')[-1].split('/')[0] if '@' in settings.database_url else 'local'}")
        engine = create_engine(settings.database_url)
        
        with engine.connect() as conn:
            # Check current version
            result = conn.execute(text('SELECT version_num FROM alembic_version'))
            current_version = result.scalar()
            print(f"\n✅ Current Alembic version: {current_version}")
            
            # Check if problematic permissions exist (from migration 021)
            perm_result = conn.execute(
                text("""
                    SELECT code FROM permissions 
                    WHERE code IN ('can_edit_tally_log_entries', 'can_delete_tally_log_entries', 'can_transfer_tally_log_entries')
                """)
            )
            existing_perms = [row[0] for row in perm_result.fetchall()]
            
            if existing_perms:
                print(f"\n⚠️  WARNING: Found permissions that suggest partial migration:")
                for perm in existing_perms:
                    print(f"   - {perm}")
                print("\n   These should be deleted if the migration failed.")
            else:
                print("\n✅ No problematic permissions found.")
            
            # Check version length
            if current_version and len(current_version) > 32:
                print(f"\n❌ ERROR: Version '{current_version}' is {len(current_version)} characters long!")
                print("   This exceeds the 32-character limit and will cause migration failures.")
            elif current_version:
                print(f"\n✅ Version length: {len(current_version)} characters (limit: 32)")
            
            return current_version, existing_perms
            
    except Exception as e:
        print(f"\n❌ Error checking version: {e}")
        return None, []

if __name__ == "__main__":
    check_alembic_version()


