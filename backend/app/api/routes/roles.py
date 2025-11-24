from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ...database import get_db
from ...schemas.role import (
    RoleCreate,
    RoleUpdate,
    RoleResponse,
    RoleWithPermissions,
    AssignPermissionsRequest,
)
from ...schemas.permission import PermissionResponse
from ...crud import role as role_crud
from ...crud import permission as permission_crud
from ...auth.dependencies import get_current_user
from ...models import User

router = APIRouter()


async def require_admin_or_superadmin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency to ensure user has SUPERADMIN or ADMIN role in RBAC system."""
    user_role_names = [role.name for role in current_user.roles]
    if not any(role_name in ['SUPERADMIN', 'ADMIN'] for role_name in user_role_names):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or Superadmin role required"
        )
    return current_user


@router.post("", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
async def create_role(
    role_data: RoleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_superadmin)
):
    """
    Create a new custom role (SUPERADMIN and ADMIN can create).
    Cannot create system roles.
    """
    # Check if role name already exists
    existing_role = role_crud.get_role_by_name(db, role_data.name)
    if existing_role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role name already exists"
        )
    
    # Validate all permission IDs exist
    for permission_id in role_data.permission_ids:
        permission = permission_crud.get_permission_by_id(db, permission_id)
        if not permission:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Permission ID {permission_id} does not exist"
            )
    
    # Create the role
    new_role = role_crud.create_role(db, role_data)
    return new_role


@router.get("", response_model=List[RoleResponse])
async def list_roles(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all roles (authenticated users can view).
    """
    roles = role_crud.get_all_roles(db, skip=skip, limit=limit)
    return roles


@router.get("/{role_id}", response_model=RoleWithPermissions)
async def get_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific role with its permissions (authenticated users can view).
    """
    role = role_crud.get_role_by_id(db, role_id)
    
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    
    # Convert permissions to response format
    permissions_response = [
        PermissionResponse.model_validate(perm) for perm in role.permissions
    ]
    
    return RoleWithPermissions(
        id=role.id,
        name=role.name,
        description=role.description,
        is_system=role.is_system,
        created_at=role.created_at,
        updated_at=role.updated_at,
        permissions=permissions_response
    )


@router.put("/{role_id}", response_model=RoleResponse)
async def update_role(
    role_id: int,
    role_data: RoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_superadmin)
):
    """
    Update a role (SUPERADMIN and ADMIN can update).
    Cannot update system roles.
    """
    # Check if role exists
    existing_role = role_crud.get_role_by_id(db, role_id)
    if not existing_role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    
    # Cannot update system roles
    if existing_role.is_system:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot update system roles"
        )
    
    # Check if new name is taken (if provided and different)
    if role_data.name and role_data.name != existing_role.name:
        name_check = role_crud.get_role_by_name(db, role_data.name)
        if name_check:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Role name already exists"
            )
    
    # Validate permission IDs if provided
    if role_data.permission_ids is not None:
        for permission_id in role_data.permission_ids:
            permission = permission_crud.get_permission_by_id(db, permission_id)
            if not permission:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Permission ID {permission_id} does not exist"
                )
    
    # Update the role
    updated_role = role_crud.update_role(db, role_id, role_data)
    
    if not updated_role:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update role"
        )
    
    return updated_role


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_superadmin)
):
    """
    Delete a role (SUPERADMIN and ADMIN can delete).
    Cannot delete system roles or roles with assigned users.
    """
    # Check if role exists
    role = role_crud.get_role_by_id(db, role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    
    # Cannot delete system roles
    if role.is_system:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete system roles"
        )
    
    # Check if role has users
    user_count = role_crud.get_role_users_count(db, role_id)
    if user_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete role with {user_count} assigned user(s). Remove users from this role first."
        )
    
    # Delete the role
    success = role_crud.delete_role(db, role_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete role"
        )
    
    return None


@router.post("/{role_id}/permissions", status_code=status.HTTP_200_OK)
async def assign_permissions(
    role_id: int,
    request: AssignPermissionsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_superadmin)
):
    """
    Assign permissions to a role (replaces existing permissions).
    """
    # Check if role exists
    role = role_crud.get_role_by_id(db, role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    
    # Cannot modify system roles
    if role.is_system:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify permissions of system roles"
        )
    
    # Validate all permission IDs exist
    for permission_id in request.permission_ids:
        permission = permission_crud.get_permission_by_id(db, permission_id)
        if not permission:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Permission ID {permission_id} does not exist"
            )
    
    # Assign permissions
    success = role_crud.assign_permissions_to_role(db, role_id, request.permission_ids)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to assign permissions"
        )
    
    return {"message": "Permissions assigned successfully"}


@router.delete("/{role_id}/permissions/{permission_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_permission(
    role_id: int,
    permission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_superadmin)
):
    """
    Remove a permission from a role.
    """
    # Check if role exists
    role = role_crud.get_role_by_id(db, role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    
    # Cannot modify system roles
    if role.is_system:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify permissions of system roles"
        )
    
    # Remove permission
    success = role_crud.remove_permission_from_role(db, role_id, permission_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permission not found or not assigned to this role"
        )
    
    return None

