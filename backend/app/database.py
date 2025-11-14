from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings

# Create database engine
# SQLite needs special connection args, SQL Server (Azure SQL) works with default args
if "sqlite" in settings.database_url:
    connect_args = {"check_same_thread": False}
    engine_kwargs = {}
else:
    # For Azure SQL Database, use connection pooling and timeout settings
    connect_args = {}
    # Add connection pool settings for Azure SQL
    engine_kwargs = {
        "pool_pre_ping": True,  # Verify connections before using
        "pool_recycle": 3600,   # Recycle connections after 1 hour
    }

engine = create_engine(
    settings.database_url,
    connect_args=connect_args,
    **engine_kwargs
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

