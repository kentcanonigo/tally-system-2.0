from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from ..models.user import UserRole


# Token schemas
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[int] = None


# Login schema
class UserLogin(BaseModel):
    username: str
    password: str


# User creation schema (for superadmin)
class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=6)
    role: UserRole = UserRole.ADMIN
    plant_ids: List[int] = Field(default_factory=list, description="List of plant IDs this user can access")


# User update schema (for superadmin)
class UserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=255)
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=6)
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    plant_ids: Optional[List[int]] = Field(None, description="List of plant IDs this user can access")


# User response schema (without password)
class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime
    plant_ids: List[int] = Field(default_factory=list, description="List of plant IDs this user can access")
    
    model_config = ConfigDict(from_attributes=True)


# Detailed user response with plant permissions
class UserDetailResponse(BaseModel):
    id: int
    username: str
    email: str
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime
    plant_permissions: List[dict] = Field(default_factory=list)
    
    model_config = ConfigDict(from_attributes=True)

