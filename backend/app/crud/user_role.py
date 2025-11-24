from sqlalchemy.orm import Session
from typing import List
from ..models.role import Role
from ..models.user_role import UserRole


def assign_roles_to_user(db: Session, user_id: int, role_ids: List[int]) -> bool:
    """Assign multiple roles to a user (replaces existing custom role assignments)."""
    # Remove existing non-system role assignments
    # Keep system roles (SUPERADMIN, ADMIN) assigned via the old user.role column
    db.query(UserRole).filter(UserRole.user_id == user_id).delete()
    
    # Add new role assignments
    for role_id in role_ids:
        # Verify role exists
        role = db.query(Role).filter(Role.id == role_id).first()
        if role:
            user_role = UserRole(
                user_id=user_id,
                role_id=role_id
            )
            db.add(user_role)
    
    db.commit()
    return True


def remove_role_from_user(db: Session, user_id: int, role_id: int) -> bool:
    """Remove a specific role from a user."""
    result = db.query(UserRole).filter(
        UserRole.user_id == user_id,
        UserRole.role_id == role_id
    ).delete()
    
    db.commit()
    return result > 0


def get_user_roles(db: Session, user_id: int) -> List[Role]:
    """Get all roles assigned to a user."""
    user_roles = db.query(UserRole).filter(UserRole.user_id == user_id).all()
    role_ids = [ur.role_id for ur in user_roles]
    
    if not role_ids:
        return []
    
    return db.query(Role).filter(Role.id.in_(role_ids)).all()


def get_user_role_ids(db: Session, user_id: int) -> List[int]:
    """Get all role IDs assigned to a user."""
    user_roles = db.query(UserRole).filter(UserRole.user_id == user_id).all()
    return [ur.role_id for ur in user_roles]

