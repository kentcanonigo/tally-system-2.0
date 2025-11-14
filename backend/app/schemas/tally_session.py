from pydantic import BaseModel, ConfigDict
from datetime import datetime, date
from typing import Optional
from enum import Enum


class TallySessionStatus(str, Enum):
    ONGOING = "ongoing"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TallySessionBase(BaseModel):
    customer_id: int
    plant_id: int
    date: date
    status: TallySessionStatus = TallySessionStatus.ONGOING


class TallySessionCreate(TallySessionBase):
    pass


class TallySessionUpdate(BaseModel):
    customer_id: Optional[int] = None
    plant_id: Optional[int] = None
    date: Optional[date] = None
    status: Optional[TallySessionStatus] = None


class TallySessionResponse(TallySessionBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

