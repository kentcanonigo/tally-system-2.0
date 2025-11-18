from pydantic import BaseModel, ConfigDict, field_validator
from datetime import datetime
from typing import Optional


class AllocationDetailsBase(BaseModel):
    required_bags: float = 0.0
    allocated_bags_tally: float = 0.0
    allocated_bags_dispatcher: float = 0.0

    @field_validator('required_bags', 'allocated_bags_tally', 'allocated_bags_dispatcher')
    @classmethod
    def validate_bags(cls, v):
        if v < 0:
            raise ValueError('bags must be non-negative')
        return v


class AllocationDetailsCreate(AllocationDetailsBase):
    tally_session_id: int
    weight_classification_id: int


class AllocationDetailsUpdate(BaseModel):
    weight_classification_id: Optional[int] = None
    required_bags: Optional[float] = None
    allocated_bags_tally: Optional[float] = None
    allocated_bags_dispatcher: Optional[float] = None

    @field_validator('required_bags', 'allocated_bags_tally', 'allocated_bags_dispatcher')
    @classmethod
    def validate_bags(cls, v):
        if v is not None and v < 0:
            raise ValueError('bags must be non-negative')
        return v


class AllocationDetailsResponse(AllocationDetailsBase):
    id: int
    tally_session_id: int
    weight_classification_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

