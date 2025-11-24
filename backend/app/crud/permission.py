from sqlalchemy.orm import Session
from typing import List, Optional
from ..models.permission import Permission
from ..models.role import Role


def get_all_permissions(db: Session) -> List[Permission]:
    """Get all permissions."""
    return db.query(Permission).order_by(Permission.category, Permission.name).all()


def get_permission_by_code(db: Session, code: str) -> Optional[Permission]:
    """Get a permission by its code."""
    return db.query(Permission).filter(Permission.code == code).first()


def get_permission_by_id(db: Session, permission_id: int) -> Optional[Permission]:
    """Get a permission by its ID."""
    return db.query(Permission).filter(Permission.id == permission_id).first()


def get_permissions_by_role(db: Session, role_id: int) -> List[Permission]:
    """Get all permissions for a specific role."""
    role = db.query(Role).filter(Role.id == role_id).first()
    if role:
        return role.permissions
    return []

