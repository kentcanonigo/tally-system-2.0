from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ...database import get_db
from ...schemas.user import UserLogin, Token, UserResponse, UserPreferencesUpdate
from ...crud import user as user_crud
from ...auth.jwt import create_access_token
from ...auth.dependencies import get_current_user
from ...models import User

router = APIRouter()


@router.post("/login", response_model=Token)
async def login(
    login_data: UserLogin,
    db: Session = Depends(get_db)
):
    """
    Authenticate user and return JWT access token.
    
    Args:
        login_data: Username and password
        db: Database session
    
    Returns:
        Access token
    
    Raises:
        HTTPException: If credentials are invalid
    """
    # Authenticate user
    user = user_crud.authenticate_user(db, login_data.username, login_data.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create access token
    # Note: 'sub' must be a string per JWT specification
    access_token = create_access_token(
        data={"sub": str(user.id), "username": user.username, "role": user.role.value}
    )
    
    return Token(access_token=access_token, token_type="bearer")


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current authenticated user's information.
    
    Args:
        current_user: Current authenticated user from JWT token
        db: Database session
    
    Returns:
        User information including accessible plant IDs, role IDs, and permissions
    """
    # Get user's plant IDs
    plant_ids = user_crud.get_user_plant_ids(db, current_user.id)
    
    # Get user's role IDs
    role_ids = user_crud.get_user_role_ids(db, current_user.id)
    
    # Get user's aggregated permissions
    permissions = user_crud.get_user_permissions(db, current_user.id)
    
    # Return user info with plant IDs, role IDs, permissions, and preferences
    user_response = UserResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        role=current_user.role,
        is_active=current_user.is_active,
        created_at=current_user.created_at,
        updated_at=current_user.updated_at,
        plant_ids=plant_ids,
        role_ids=role_ids,
        permissions=permissions,
        timezone=current_user.timezone,
        active_plant_id=current_user.active_plant_id,
        acceptable_difference_threshold=current_user.acceptable_difference_threshold,
        visible_tabs=current_user.visible_tabs
    )
    
    return user_response


@router.put("/me/preferences", response_model=UserResponse)
async def update_user_preferences(
    preferences: UserPreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update current user's preferences (timezone, active plant, difference threshold).
    
    Args:
        preferences: User preferences to update
        current_user: Current authenticated user from JWT token
        db: Database session
    
    Returns:
        Updated user information
    """
    # Update only provided preferences
    if preferences.timezone is not None:
        current_user.timezone = preferences.timezone
    
    if preferences.active_plant_id is not None:
        current_user.active_plant_id = preferences.active_plant_id
    
    if preferences.acceptable_difference_threshold is not None:
        if preferences.acceptable_difference_threshold < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Acceptable difference threshold must be greater than or equal to 0"
            )
        current_user.acceptable_difference_threshold = preferences.acceptable_difference_threshold
    
    if preferences.visible_tabs is not None:
        # Validate that visible_tabs is a list of strings
        if not isinstance(preferences.visible_tabs, list):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="visible_tabs must be a list of tab names"
            )
        current_user.visible_tabs = preferences.visible_tabs
    
    db.commit()
    db.refresh(current_user)
    
    # Get updated user info
    plant_ids = user_crud.get_user_plant_ids(db, current_user.id)
    role_ids = user_crud.get_user_role_ids(db, current_user.id)
    permissions = user_crud.get_user_permissions(db, current_user.id)
    
    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        role=current_user.role,
        is_active=current_user.is_active,
        created_at=current_user.created_at,
        updated_at=current_user.updated_at,
        plant_ids=plant_ids,
        role_ids=role_ids,
        permissions=permissions,
        timezone=current_user.timezone,
        active_plant_id=current_user.active_plant_id,
        acceptable_difference_threshold=current_user.acceptable_difference_threshold,
        visible_tabs=current_user.visible_tabs
    )

