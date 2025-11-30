"""
Reset admin password script.

This script resets the admin user's password to the default: admin123

Usage:
    python reset_admin_password.py [new_password]

If no password is provided, it will reset to the default: admin123
"""
import sys
from pathlib import Path

# Add parent directory to path to allow imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import User, UserRole
from app.auth.password import hash_password


def reset_admin_password(db: Session, new_password: str = "admin123"):
    """Reset the admin user's password."""
    
    # Find admin user by username or superadmin role
    admin_user = db.query(User).filter(
        (User.username == "admin") | (User.role == UserRole.SUPERADMIN)
    ).first()
    
    if not admin_user:
        print("❌ No admin user found!")
        print("   Run 'python seed_admin.py' to create the admin user first.")
        return False
    
    # Update password
    admin_user.hashed_password = hash_password(new_password)
    db.commit()
    
    print("=" * 60)
    print("✓ Admin password reset successfully!")
    print("=" * 60)
    print(f"Username: {admin_user.username}")
    print(f"Email:    {admin_user.email}")
    print(f"Password: {new_password}")
    print("=" * 60)
    print("⚠️  IMPORTANT: Please change the password after logging in!")
    print("=" * 60)
    
    return True


def main():
    """Main function."""
    print("\n🔐 Tally System - Admin Password Reset\n")
    
    # Get new password from command line argument if provided
    new_password = sys.argv[1] if len(sys.argv) > 1 else "admin123"
    
    if len(new_password) < 6:
        print("❌ Error: Password must be at least 6 characters long!")
        sys.exit(1)
    
    try:
        db = SessionLocal()
        try:
            reset_admin_password(db, new_password)
        finally:
            db.close()
        
        print("\n✓ Password reset completed successfully!\n")
        
    except Exception as e:
        print(f"\n❌ Error resetting password: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

