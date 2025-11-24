from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ...database import get_db
from ...schemas.user import UserCreate, UserUpdate, UserResponse
from ...schemas.permission import PermissionResponse
from ...crud import user as user_crud
from ...auth.dependencies import require_superadmin
from ...models import User

router = APIRouter()


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin)
):
    """
    Create a new user (superadmin only).
    
    Args:
        user_data: User creation data
        db: Database session
        current_user: Current superadmin user
    
    Returns:
        Created user information
    
    Raises:
        HTTPException: If username or email already exists
    """
    # Check if username already exists
    existing_user = user_crud.get_user_by_username(db, user_data.username)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    # Check if email already exists
    existing_email = user_crud.get_user_by_email(db, user_data.email)
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create user
    new_user = user_crud.create_user(db, user_data)
    
    # Get plant IDs, role IDs, and permissions for response
    plant_ids = user_crud.get_user_plant_ids(db, new_user.id)
    role_ids = user_crud.get_user_role_ids(db, new_user.id)
    permissions = user_crud.get_user_permissions(db, new_user.id)
    
    return UserResponse(
        id=new_user.id,
        username=new_user.username,
        email=new_user.email,
        role=new_user.role,
        is_active=new_user.is_active,
        created_at=new_user.created_at,
        updated_at=new_user.updated_at,
        plant_ids=plant_ids,
        role_ids=role_ids,
        permissions=permissions
    )


@router.get("", response_model=List[UserResponse])
async def list_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin)
):
    """
    List all users (superadmin only).
    
    Args:
        skip: Number of records to skip
        limit: Maximum number of records to return
        db: Database session
        current_user: Current superadmin user
    
    Returns:
        List of users with their information
    """
    users = user_crud.get_all_users(db, skip=skip, limit=limit)
    
    # Build response with plant IDs, role IDs, and permissions for each user
    response = []
    for user in users:
        plant_ids = user_crud.get_user_plant_ids(db, user.id)
        role_ids = user_crud.get_user_role_ids(db, user.id)
        permissions = user_crud.get_user_permissions(db, user.id)
        response.append(UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            role=user.role,
            is_active=user.is_active,
            created_at=user.created_at,
            updated_at=user.updated_at,
            plant_ids=plant_ids,
            role_ids=role_ids,
            permissions=permissions
        ))
    
    return response


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin)
):
    """
    Get a specific user by ID (superadmin only).
    
    Args:
        user_id: ID of the user to retrieve
        db: Database session
        current_user: Current superadmin user
    
    Returns:
        User information
    
    Raises:
        HTTPException: If user not found
    """
    user = user_crud.get_user_by_id(db, user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    plant_ids = user_crud.get_user_plant_ids(db, user.id)
    role_ids = user_crud.get_user_role_ids(db, user.id)
    permissions = user_crud.get_user_permissions(db, user.id)
    
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        updated_at=user.updated_at,
        plant_ids=plant_ids,
        role_ids=role_ids,
        permissions=permissions
    )


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin)
):
    """
    Update a user (superadmin only).
    
    Args:
        user_id: ID of the user to update
        user_data: User update data
        db: Database session
        current_user: Current superadmin user
    
    Returns:
        Updated user information
    
    Raises:
        HTTPException: If user not found, username/email already taken, or trying to downgrade last superadmin
    """
    # Check if user exists
    existing_user = user_crud.get_user_by_id(db, user_id)
    if not existing_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if new username is taken (if provided and different)
    if user_data.username and user_data.username != existing_user.username:
        username_check = user_crud.get_user_by_username(db, user_data.username)
        if username_check:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken"
            )
    
    # Check if new email is taken (if provided and different)
    if user_data.email and user_data.email != existing_user.email:
        email_check = user_crud.get_user_by_email(db, user_data.email)
        if email_check:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already taken"
            )
    
    # Prevent downgrading the last superadmin
    if user_data.role and existing_user.role == "superadmin" and user_data.role != "superadmin":
        superadmin_count = user_crud.count_superadmins(db)
        if superadmin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot change the role of the last superadmin. At least one superadmin must remain in the system."
            )
    
    # Update user
    updated_user = user_crud.update_user(db, user_id, user_data)
    
    if not updated_user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user"
        )
    
    plant_ids = user_crud.get_user_plant_ids(db, updated_user.id)
    role_ids = user_crud.get_user_role_ids(db, updated_user.id)
    permissions = user_crud.get_user_permissions(db, updated_user.id)
    
    return UserResponse(
        id=updated_user.id,
        username=updated_user.username,
        email=updated_user.email,
        role=updated_user.role,
        is_active=updated_user.is_active,
        created_at=updated_user.created_at,
        updated_at=updated_user.updated_at,
        plant_ids=plant_ids,
        role_ids=role_ids,
        permissions=permissions
    )


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin)
):
    """
    Delete a user (superadmin only).
    
    Args:
        user_id: ID of the user to delete
        db: Database session
        current_user: Current superadmin user
    
    Raises:
        HTTPException: If user not found, trying to delete themselves, or deleting last superadmin
    """
    # Prevent superadmin from deleting themselves
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )
    
    # Check if user exists and get their role
    user_to_delete = user_crud.get_user_by_id(db, user_id)
    if not user_to_delete:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Prevent deleting the last superadmin
    if user_to_delete.role == "superadmin":
        superadmin_count = user_crud.count_superadmins(db)
        if superadmin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete the last superadmin. At least one superadmin must remain in the system."
            )
    
    # Delete user
    success = user_crud.delete_user(db, user_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete user"
        )
    
    return None


@router.get("/{user_id}/permissions", response_model=List[str])
async def get_user_permissions(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin)
):
    """
    Get aggregated permissions for a specific user (superadmin only).
    
    Args:
        user_id: ID of the user
        db: Database session
        current_user: Current superadmin user
    
    Returns:
        List of permission codes
    
    Raises:
        HTTPException: If user not found
    """
    user = user_crud.get_user_by_id(db, user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    permissions = user_crud.get_user_permissions(db, user_id)
    return permissions

