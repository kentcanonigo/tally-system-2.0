from pydantic import BaseModel, Field, ConfigDict, field_validator
from pydantic_core import PydanticCustomError
from typing import Optional, List
from datetime import datetime
from ..models.user import UserRole
import re


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
    
    class Config:
        from_attributes = True


# User creation schema (for superadmin)
class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=255)
    email: str
    password: str = Field(..., min_length=6)
    role: UserRole = UserRole.ADMIN
    plant_ids: List[int] = Field(default_factory=list, description="List of plant IDs this user can access")
    role_ids: List[int] = Field(default_factory=list, description="List of role IDs to assign to this user")
    
    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        """
        Validate email format with lenient rules to allow .local and internal domains.
        """
        if not v or '@' not in v:
            raise PydanticCustomError(
                'value_error',
                'Invalid email format: must contain @'
            )
        
        local_part, domain = v.rsplit('@', 1)
        
        if not local_part or not domain:
            raise PydanticCustomError(
                'value_error',
                'Invalid email format'
            )
        
        # Allow standard domains and .local domains for internal use
        email_pattern = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$|^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.local$')
        if not email_pattern.match(v):
            raise PydanticCustomError(
                'value_error',
                'Invalid email format'
            )
        
        return v.lower()


# User update schema (for superadmin)
class UserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=255)
    email: Optional[str] = None
    password: Optional[str] = Field(None, min_length=6)
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    plant_ids: Optional[List[int]] = Field(None, description="List of plant IDs this user can access")
    role_ids: Optional[List[int]] = Field(None, description="List of role IDs to assign to this user")
    
    @field_validator('email')
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        """
        Validate email format with lenient rules to allow .local and internal domains.
        """
        if v is None:
            return v
            
        if not v or '@' not in v:
            raise PydanticCustomError(
                'value_error',
                'Invalid email format: must contain @'
            )
        
        local_part, domain = v.rsplit('@', 1)
        
        if not local_part or not domain:
            raise PydanticCustomError(
                'value_error',
                'Invalid email format'
            )
        
        # Allow standard domains and .local domains for internal use
        email_pattern = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$|^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.local$')
        if not email_pattern.match(v):
            raise PydanticCustomError(
                'value_error',
                'Invalid email format'
            )
        
        return v.lower()


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
    role_ids: List[int] = Field(default_factory=list, description="List of role IDs assigned to this user")
    permissions: List[str] = Field(default_factory=list, description="Aggregated permission codes from all roles")
    
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

