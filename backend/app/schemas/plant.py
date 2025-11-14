from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional


class PlantBase(BaseModel):
    name: str


class PlantCreate(PlantBase):
    pass


class PlantUpdate(BaseModel):
    name: Optional[str] = None


class PlantResponse(PlantBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

