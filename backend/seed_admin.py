"""
Seed script to create a default superadmin user.

Usage:
    python -m backend.seed_admin

Or from the backend directory:
    python seed_admin.py
"""
import sys
from pathlib import Path

# Add parent directory to path to allow imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from app.database import SessionLocal, engine, Base
from app.models import User, UserRole
from app.auth.password import hash_password


def create_default_superadmin(db: Session):
    """Create default superadmin user if no superadmin exists."""
    
    default_username = "admin"
    default_email = "admin@tallysystem.local"
    default_password = "admin123"
    
    # Check if any superadmin exists
    existing_superadmin = db.query(User).filter(User.role == UserRole.SUPERADMIN).first()
    
    if existing_superadmin:
        # Update the password hash (in case hashing method changed)
        existing_superadmin.hashed_password = hash_password(default_password)
        db.commit()
        print(f"✓ Superadmin already exists: {existing_superadmin.username}")
        print(f"✓ Password updated to default: {default_password}")
        return existing_superadmin
    
    # Check if username already exists
    existing_user = db.query(User).filter(User.username == default_username).first()
    if existing_user:
        print(f"✗ User '{default_username}' already exists but is not a superadmin!")
        print(f"  Please manually update or delete this user first.")
        return None
    
    # Create superadmin user
    superadmin = User(
        username=default_username,
        email=default_email,
        hashed_password=hash_password(default_password),
        role=UserRole.SUPERADMIN,
        is_active=True
    )
    
    db.add(superadmin)
    db.commit()
    db.refresh(superadmin)
    
    print("=" * 60)
    print("✓ Default superadmin user created successfully!")
    print("=" * 60)
    print(f"Username: {default_username}")
    print(f"Password: {default_password}")
    print(f"Email:    {default_email}")
    print("=" * 60)
    print("⚠️  IMPORTANT: Please change the password after first login!")
    print("=" * 60)
    
    return superadmin


def main():
    """Main function to run the seed script."""
    print("\n🌱 Tally System - Superadmin Seed Script\n")
    
    try:
        # Create tables if they don't exist
        print("Ensuring database tables exist...")
        Base.metadata.create_all(bind=engine)
        print("✓ Database tables ready\n")
        
        # Create database session
        db = SessionLocal()
        
        try:
            # Create superadmin
            create_default_superadmin(db)
            
        finally:
            db.close()
        
        print("\n✓ Seed script completed successfully!\n")
        
    except Exception as e:
        print(f"\n✗ Error running seed script: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()