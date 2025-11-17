from pydantic import BaseModel, ConfigDict, field_validator, model_validator
from datetime import datetime
from typing import Optional, Literal


# Define allowed category values
CategoryType = Literal['Dressed', 'Byproduct']


class WeightClassificationBase(BaseModel):
    classification: str
    min_weight: float
    max_weight: float
    category: CategoryType

    @field_validator('category')
    @classmethod
    def validate_category(cls, v: str) -> str:
        allowed_categories = ['Dressed', 'Byproduct']
        if v not in allowed_categories:
            raise ValueError(f'category must be one of: {", ".join(allowed_categories)}')
        return v

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
    category: Optional[CategoryType] = None

    @field_validator('category')
    @classmethod
    def validate_category(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        allowed_categories = ['Dressed', 'Byproduct']
        if v not in allowed_categories:
            raise ValueError(f'category must be one of: {", ".join(allowed_categories)}')
        return v


class WeightClassificationResponse(WeightClassificationBase):
    id: int
    plant_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

