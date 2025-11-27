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
from app.models.role import Role
from app.models.user_role import UserRole as UserRoleModel
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
        
        # Ensure SUPERADMIN role is assigned via RBAC
        superadmin_role = db.query(Role).filter(Role.name == 'SUPERADMIN').first()
        if superadmin_role:
            # Check if role is already assigned
            existing_user_role = db.query(UserRoleModel).filter(
                UserRoleModel.user_id == existing_superadmin.id,
                UserRoleModel.role_id == superadmin_role.id
            ).first()
            
            if not existing_user_role:
                # Assign the role
                user_role = UserRoleModel(
                    user_id=existing_superadmin.id,
                    role_id=superadmin_role.id
                )
                db.add(user_role)
                print(f"✓ SUPERADMIN role assigned via RBAC")
        
        db.commit()
        print(f"✓ Superadmin already exists: {existing_superadmin.username}")
        print(f"✓ Password updated to default: {default_password}")
        return existing_superadmin
    
    # Check if username already exists
    existing_user = db.query(User).filter(User.username == default_username).first()
    if existing_user:
        # If user exists, try to assign SUPERADMIN role if missing
        superadmin_role = db.query(Role).filter(Role.name == 'SUPERADMIN').first()
        if superadmin_role:
            # Check if role is already assigned
            existing_user_role = db.query(UserRoleModel).filter(
                UserRoleModel.user_id == existing_user.id,
                UserRoleModel.role_id == superadmin_role.id
            ).first()
            
            if not existing_user_role:
                # Update legacy role field and assign RBAC role
                existing_user.role = UserRole.SUPERADMIN
                user_role = UserRoleModel(
                    user_id=existing_user.id,
                    role_id=superadmin_role.id
                )
                db.add(user_role)
                db.commit()
                print(f"✓ User '{default_username}' found and SUPERADMIN role assigned!")
                print(f"✓ Password updated to default: {default_password}")
                existing_user.hashed_password = hash_password(default_password)
                db.commit()
                return existing_user
            else:
                # Role already assigned, just update password
                existing_user.hashed_password = hash_password(default_password)
                existing_user.role = UserRole.SUPERADMIN
                db.commit()
                print(f"✓ User '{default_username}' already has SUPERADMIN role assigned.")
                print(f"✓ Password updated to default: {default_password}")
                return existing_user
        else:
            print(f"✗ User '{default_username}' already exists but SUPERADMIN role not found!")
            print(f"  Please ensure migrations have been run.")
            return None
    
    # Create superadmin user
    superadmin = User(
        username=default_username,
        email=default_email,
        hashed_password=hash_password(default_password),
        role=UserRole.SUPERADMIN,  # Legacy field for backward compatibility
        is_active=True
    )
    
    db.add(superadmin)
    db.flush()  # Flush to get the user ID
    
    # Assign SUPERADMIN role via RBAC system
    superadmin_role = db.query(Role).filter(Role.name == 'SUPERADMIN').first()
    if superadmin_role:
        user_role = UserRoleModel(
            user_id=superadmin.id,
            role_id=superadmin_role.id
        )
        db.add(user_role)
    else:
        print("⚠️  WARNING: SUPERADMIN role not found in roles table!")
        print("   The user was created but may not have proper permissions.")
        print("   Make sure migrations have been run.")
    
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