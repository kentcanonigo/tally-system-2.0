from pydantic import BaseModel, ConfigDict, field_validator
from datetime import datetime
from typing import Optional
from enum import Enum


class TallyLogEntryRole(str, Enum):
    TALLY = "tally"
    DISPATCHER = "dispatcher"


class TallyLogEntryBase(BaseModel):
    weight: float
    role: TallyLogEntryRole
    heads: Optional[float] = 15.0
    notes: Optional[str] = None

    @field_validator('weight')
    @classmethod
    def validate_weight(cls, v):
        if v <= 0:
            raise ValueError('weight must be greater than 0')
        return v

    @field_validator('heads')
    @classmethod
    def validate_heads(cls, v):
        if v is not None and v < 0:
            raise ValueError('heads must be non-negative')
        return v


class TallyLogEntryCreate(TallyLogEntryBase):
    tally_session_id: int
    weight_classification_id: int


class TallyLogEntryResponse(TallyLogEntryBase):
    id: int
    tally_session_id: int
    weight_classification_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

