from pydantic import BaseModel, ConfigDict, field_validator
from datetime import datetime
from typing import Optional, List
from enum import Enum


class TallyLogEntryRole(str, Enum):
    TALLY = "tally"
    DISPATCHER = "dispatcher"


class TallyLogEntryBase(BaseModel):
    weight: float
    role: TallyLogEntryRole
    heads: Optional[float] = 15.0  # Note: For Byproduct category items, heads is automatically set to 1.0 regardless of input
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


class TallyLogEntryUpdate(BaseModel):
    """Update schema for tally log entries. All fields are optional."""
    weight: Optional[float] = None
    role: Optional[TallyLogEntryRole] = None
    heads: Optional[float] = None
    notes: Optional[str] = None
    weight_classification_id: Optional[int] = None
    tally_session_id: Optional[int] = None

    @field_validator('weight')
    @classmethod
    def validate_weight(cls, v):
        if v is not None and v <= 0:
            raise ValueError('weight must be greater than 0')
        return v

    @field_validator('heads')
    @classmethod
    def validate_heads(cls, v):
        if v is not None and v < 0:
            raise ValueError('heads must be non-negative')
        return v


class TallyLogEntryResponse(TallyLogEntryBase):
    id: int
    tally_session_id: int
    weight_classification_id: int
    created_at: datetime
    original_session_id: Optional[int] = None
    transferred_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class TallyLogEntryTransfer(BaseModel):
    entry_ids: List[int]
    target_session_id: int
