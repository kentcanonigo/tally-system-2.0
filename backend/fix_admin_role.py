"""
Quick fix script to assign SUPERADMIN role to existing admin user via RBAC.

Usage:
    python fix_admin_role.py
"""
import sys
from pathlib import Path

# Add parent directory to path to allow imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import User, UserRole
from app.models.role import Role
from app.models.user_role import UserRole as UserRoleModel


def fix_admin_role():
    """Assign SUPERADMIN role to admin user if missing."""
    db = SessionLocal()
    
    try:
        # Find admin user
        admin_user = db.query(User).filter(User.username == 'admin').first()
        
        if not admin_user:
            print("✗ Admin user not found!")
            return False
        
        # Find SUPERADMIN role
        superadmin_role = db.query(Role).filter(Role.name == 'SUPERADMIN').first()
        
        if not superadmin_role:
            print("✗ SUPERADMIN role not found in database!")
            print("  Make sure migrations have been run.")
            return False
        
        # Check if role is already assigned
        existing_user_role = db.query(UserRoleModel).filter(
            UserRoleModel.user_id == admin_user.id,
            UserRoleModel.role_id == superadmin_role.id
        ).first()
        
        if existing_user_role:
            print("✓ Admin user already has SUPERADMIN role assigned.")
            return True
        
        # Assign the role
        user_role = UserRoleModel(
            user_id=admin_user.id,
            role_id=superadmin_role.id
        )
        db.add(user_role)
        
        # Also ensure legacy role field is set
        admin_user.role = UserRole.SUPERADMIN
        
        db.commit()
        
        print("=" * 60)
        print("✓ SUPERADMIN role assigned to admin user successfully!")
        print("=" * 60)
        print(f"User ID: {admin_user.id}")
        print(f"Username: {admin_user.username}")
        print(f"Email: {admin_user.email}")
        print("=" * 60)
        
        return True
        
    except Exception as e:
        print(f"✗ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    print("\n🔧 Fix Admin Role Script\n")
    success = fix_admin_role()
    if success:
        print("\n✓ Script completed successfully!\n")
    else:
        print("\n✗ Script failed. Please check the errors above.\n")
        sys.exit(1)

