from typing import Optional, List
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, UserRole, PlantPermission
from ..crud import user as user_crud
from .jwt import decode_access_token

# HTTP Bearer token security
security = HTTPBearer()


def user_has_role(user: User, role_name: str) -> bool:
    """
    Helper function to check if a user has a specific RBAC role.
    
    Args:
        user: The user object with roles relationship loaded
        role_name: The name of the role to check for (e.g., "SUPERADMIN")
    
    Returns:
        True if user has the role, False otherwise
    """
    return any(role.name == role_name for role in user.roles)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Dependency to get the current authenticated user from JWT token.
    
    Raises HTTPException if token is invalid or user not found.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Decode the token
    token = credentials.credentials
    payload = decode_access_token(token)
    
    if payload is None:
        raise credentials_exception
    
    # Extract user ID from token (sub is a string, convert to int)
    user_id_str: Optional[str] = payload.get("sub")
    if user_id_str is None:
        raise credentials_exception
    
    try:
        user_id = int(user_id_str)
    except (ValueError, TypeError):
        raise credentials_exception
    
    # Get user from database
    user = db.query(User).filter(User.id == user_id).first()
    
    if user is None:
        raise credentials_exception
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
    
    return user


async def require_superadmin(current_user: User = Depends(get_current_user)) -> User:
    """
    Dependency to ensure the current user is a superadmin.
    Uses RBAC role system to check if user has SUPERADMIN role.
    
    Raises HTTPException if user is not a superadmin.
    """
    if not user_has_role(current_user, 'SUPERADMIN'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Superadmin access required"
        )
    
    return current_user


def check_plant_access(plant_id: int):
    """
    Factory function that returns a dependency to check if user has access to a specific plant.
    
    Users with SUPERADMIN role have access to all plants.
    Other users need explicit plant permission.
    """
    async def _check_access(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
    ) -> User:
        # Users with SUPERADMIN role have access to everything
        if user_has_role(current_user, 'SUPERADMIN'):
            return current_user
        
        # Check if user has explicit permission for this plant
        permission = db.query(PlantPermission).filter(
            PlantPermission.user_id == current_user.id,
            PlantPermission.plant_id == plant_id
        ).first()
        
        if not permission:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this plant"
            )
        
        return current_user
    
    return _check_access


async def get_user_accessible_plant_ids(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> list[int]:
    """
    Get list of plant IDs that the current user has access to.
    
    Users with SUPERADMIN role get all plant IDs, others get only their assigned plants.
    """
    # Check if user has SUPERADMIN role
    if user_has_role(current_user, 'SUPERADMIN'):
        # Return all plant IDs
        from ..models import Plant
        plants = db.query(Plant.id).all()
        return [plant.id for plant in plants]
    
    # Return only assigned plant IDs
    permissions = db.query(PlantPermission.plant_id).filter(
        PlantPermission.user_id == current_user.id
    ).all()
    
    return [perm.plant_id for perm in permissions]


def require_permission(permission_code: str):
    """
    Factory function that returns a dependency to check for a specific permission.
    Users with SUPERADMIN role bypass all permission checks.
    
    Args:
        permission_code: The permission code to check (e.g., "can_start_tally")
    
    Returns:
        Dependency function that checks if user has the permission
    """
    async def _check_permission(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
    ) -> User:
        # Users with SUPERADMIN role have all permissions
        if user_has_role(current_user, 'SUPERADMIN'):
            return current_user
        
        # Get user's permissions from their roles
        user_permissions = user_crud.get_user_permissions(db, current_user.id)
        
        if permission_code not in user_permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{permission_code}' required"
            )
        
        return current_user
    
    return _check_permission


def require_any_permission(permission_codes: List[str]):
    """
    Factory function that returns a dependency to check for any of the specified permissions.
    User must have at least one of the permissions. Users with SUPERADMIN role bypass the check.
    
    Args:
        permission_codes: List of permission codes to check
    
    Returns:
        Dependency function that checks if user has any of the permissions
    """
    async def _check_permissions(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
    ) -> User:
        # Users with SUPERADMIN role have all permissions
        if user_has_role(current_user, 'SUPERADMIN'):
            return current_user
        
        # Get user's permissions from their roles
        user_permissions = user_crud.get_user_permissions(db, current_user.id)
        
        # Check if user has any of the required permissions
        has_any = any(perm in user_permissions for perm in permission_codes)
        
        if not has_any:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"One of these permissions required: {', '.join(permission_codes)}"
            )
        
        return current_user
    
    return _check_permissions


def require_permission_and_plant_access(permission_code: str, plant_id: int):
    """
    Factory function that returns a dependency to check both permission and plant access.
    User needs the specified permission AND access to the specified plant.
    Users with SUPERADMIN role bypass both checks.
    
    Args:
        permission_code: The permission code to check
        plant_id: The plant ID to check access for
    
    Returns:
        Dependency function that checks both permission and plant access
    """
    async def _check_both(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
    ) -> User:
        # Users with SUPERADMIN role bypass both checks
        if user_has_role(current_user, 'SUPERADMIN'):
            return current_user
        
        # Check permission
        user_permissions = user_crud.get_user_permissions(db, current_user.id)
        if permission_code not in user_permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{permission_code}' required"
            )
        
        # Check plant access
        has_plant_access = db.query(PlantPermission).filter(
            PlantPermission.user_id == current_user.id,
            PlantPermission.plant_id == plant_id
        ).first() is not None
        
        if not has_plant_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this plant"
            )
        
        return current_user
    
    return _check_both

