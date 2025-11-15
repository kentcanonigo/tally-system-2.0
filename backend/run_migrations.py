#!/usr/bin/env python
"""
Direct migration runner that bypasses Alembic's ConfigParser issues.
Run this script to apply migrations directly.
"""
import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(__file__))

from alembic import command
from alembic.config import Config
from app.config import settings

# Create Alembic config
alembic_cfg = Config()

# Set the script location
alembic_cfg.set_main_option("script_location", "alembic")

# Set the database URL directly via attributes to bypass ConfigParser interpolation
alembic_cfg.attributes['sqlalchemy.url'] = settings.database_url

# Run migrations
print(f"Running migrations with database: {settings.database_url.split('@')[-1].split('/')[0] if '@' in settings.database_url else 'local'}")
command.upgrade(alembic_cfg, "head")
print("Migrations completed successfully!")

