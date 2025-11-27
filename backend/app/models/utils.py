"""
Utility functions for models.
"""
from datetime import datetime, timezone


def utcnow():
    """
    Get current UTC datetime.
    
    Returns timezone-naive UTC datetime for SQL Server compatibility.
    SQL Server DATETIME2 columns don't accept timezone-aware datetimes,
    so we return a naive datetime in UTC timezone.
    """
    # Return timezone-naive UTC datetime for SQL Server compatibility
    # SQL Server DATETIME2 doesn't handle timezone-aware datetimes well
    return datetime.utcnow()

