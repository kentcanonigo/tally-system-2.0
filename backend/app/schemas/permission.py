from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional


class PermissionBase(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    category: str


class PermissionResponse(PermissionBase):
    id: int
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

