from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ...database import get_db
from ...schemas.user import UserLogin, Token, UserResponse
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
        User information including accessible plant IDs
    """
    # Get user's plant IDs
    plant_ids = user_crud.get_user_plant_ids(db, current_user.id)
    
    # Return user info with plant IDs
    user_response = UserResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        role=current_user.role,
        is_active=current_user.is_active,
        created_at=current_user.created_at,
        updated_at=current_user.updated_at,
        plant_ids=plant_ids
    )
    
    return user_response

