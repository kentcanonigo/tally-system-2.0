from sqlalchemy.orm import Session
from typing import List, Optional
from ..models.role import Role
from ..models.permission import Permission
from ..models.role_permission import RolePermission
from ..models.user_role import UserRole as UserRoleModel
from ..schemas.role import RoleCreate, RoleUpdate


def get_all_roles(db: Session, skip: int = 0, limit: int = 100) -> List[Role]:
    """Get all roles with pagination."""
    return db.query(Role).order_by(Role.id).offset(skip).limit(limit).all()


def get_role_by_id(db: Session, role_id: int) -> Optional[Role]:
    """Get a role by its ID."""
    return db.query(Role).filter(Role.id == role_id).first()


def get_role_by_name(db: Session, name: str) -> Optional[Role]:
    """Get a role by its name."""
    return db.query(Role).filter(Role.name == name).first()


def create_role(db: Session, role_data: RoleCreate) -> Role:
    """Create a new role with permissions."""
    # Create the role
    new_role = Role(
        name=role_data.name,
        description=role_data.description,
        is_system=False  # Custom roles are never system roles
    )
    db.add(new_role)
    db.flush()  # Get the role ID
    
    # Assign permissions
    if role_data.permission_ids:
        for permission_id in role_data.permission_ids:
            role_permission = RolePermission(
                role_id=new_role.id,
                permission_id=permission_id
            )
            db.add(role_permission)
    
    db.commit()
    db.refresh(new_role)
    return new_role


def update_role(db: Session, role_id: int, role_data: RoleUpdate) -> Optional[Role]:
    """Update a role and optionally its permissions."""
    role = db.query(Role).filter(Role.id == role_id).first()
    
    if not role:
        return None
    
    # Cannot update system roles
    if role.is_system:
        return None
    
    # Update basic fields
    if role_data.name is not None:
        role.name = role_data.name
    if role_data.description is not None:
        role.description = role_data.description
    
    # Update permissions if provided
    if role_data.permission_ids is not None:
        # Remove existing permissions
        db.query(RolePermission).filter(RolePermission.role_id == role_id).delete()
        
        # Add new permissions
        for permission_id in role_data.permission_ids:
            role_permission = RolePermission(
                role_id=role_id,
                permission_id=permission_id
            )
            db.add(role_permission)
    
    db.commit()
    db.refresh(role)
    return role


def delete_role(db: Session, role_id: int) -> bool:
    """Delete a role. Cannot delete system roles or roles with assigned users."""
    role = db.query(Role).filter(Role.id == role_id).first()
    
    if not role:
        return False
    
    # Cannot delete system roles
    if role.is_system:
        return False
    
    # Check if role has any users assigned
    user_count = db.query(UserRoleModel).filter(UserRoleModel.role_id == role_id).count()
    if user_count > 0:
        return False
    
    # Delete the role (cascade will handle role_permissions)
    db.delete(role)
    db.commit()
    return True


def assign_permissions_to_role(db: Session, role_id: int, permission_ids: List[int]) -> bool:
    """Assign multiple permissions to a role (replaces existing)."""
    role = db.query(Role).filter(Role.id == role_id).first()
    
    if not role or role.is_system:
        return False
    
    # Remove existing permissions
    db.query(RolePermission).filter(RolePermission.role_id == role_id).delete()
    
    # Add new permissions
    for permission_id in permission_ids:
        # Verify permission exists
        permission = db.query(Permission).filter(Permission.id == permission_id).first()
        if permission:
            role_permission = RolePermission(
                role_id=role_id,
                permission_id=permission_id
            )
            db.add(role_permission)
    
    db.commit()
    return True


def remove_permission_from_role(db: Session, role_id: int, permission_id: int) -> bool:
    """Remove a single permission from a role."""
    role = db.query(Role).filter(Role.id == role_id).first()
    
    if not role or role.is_system:
        return False
    
    result = db.query(RolePermission).filter(
        RolePermission.role_id == role_id,
        RolePermission.permission_id == permission_id
    ).delete()
    
    db.commit()
    return result > 0


def get_role_users_count(db: Session, role_id: int) -> int:
    """Get the number of users assigned to a role."""
    return db.query(UserRoleModel).filter(UserRoleModel.role_id == role_id).count()

