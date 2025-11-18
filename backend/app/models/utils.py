"""
Utility functions for models.
"""
from datetime import datetime, timezone


def utcnow():
    """Get current UTC datetime with timezone awareness."""
    return datetime.now(timezone.utc)

