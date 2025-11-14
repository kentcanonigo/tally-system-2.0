from pydantic import BaseModel, ConfigDict, field_validator, model_validator
from datetime import datetime
from typing import Optional


class WeightClassificationBase(BaseModel):
    classification: str
    min_weight: float
    max_weight: float
    category: str

    @model_validator(mode='after')
    def validate_weights(self):
        if self.max_weight < self.min_weight:
            raise ValueError('max_weight must be greater than or equal to min_weight')
        return self


class WeightClassificationCreate(WeightClassificationBase):
    plant_id: int


class WeightClassificationUpdate(BaseModel):
    classification: Optional[str] = None
    min_weight: Optional[float] = None
    max_weight: Optional[float] = None
    category: Optional[str] = None


class WeightClassificationResponse(WeightClassificationBase):
    id: int
    plant_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

