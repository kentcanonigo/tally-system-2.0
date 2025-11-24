from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional, List
from .permission import PermissionResponse


class RoleBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None


class RoleCreate(RoleBase):
    permission_ids: List[int] = Field(default_factory=list)


class RoleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    permission_ids: Optional[List[int]] = None


class RoleResponse(RoleBase):
    id: int
    is_system: bool
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class RoleWithPermissions(RoleResponse):
    permissions: List[PermissionResponse] = Field(default_factory=list)
    
    model_config = ConfigDict(from_attributes=True)


class AssignPermissionsRequest(BaseModel):
    permission_ids: List[int] = Field(..., min_items=1)

