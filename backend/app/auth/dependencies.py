from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, UserRole, PlantPermission
from .jwt import decode_access_token

# HTTP Bearer token security
security = HTTPBearer()


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
    
    Raises HTTPException if user is not a superadmin.
    """
    if current_user.role != UserRole.SUPERADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Superadmin access required"
        )
    
    return current_user


def check_plant_access(plant_id: int):
    """
    Factory function that returns a dependency to check if user has access to a specific plant.
    
    Superadmins have access to all plants.
    Regular admins need explicit permission.
    """
    async def _check_access(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
    ) -> User:
        # Superadmins have access to everything
        if current_user.role == UserRole.SUPERADMIN:
            return current_user
        
        # Check if admin has permission for this plant
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
    
    Superadmins get all plant IDs, regular admins get only their assigned plants.
    """
    if current_user.role == UserRole.SUPERADMIN:
        # Return all plant IDs
        from ..models import Plant
        plants = db.query(Plant.id).all()
        return [plant.id for plant in plants]
    
    # Return only assigned plant IDs
    permissions = db.query(PlantPermission.plant_id).filter(
        PlantPermission.user_id == current_user.id
    ).all()
    
    return [perm.plant_id for perm in permissions]

